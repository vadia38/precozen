#!/usr/bin/env python3
"""
Extrai produtos e fotos do catálogo em PDF (gerado pelo painel Luretec com ReportLab)
e grava o dataset canônico do site.

Uso:
  python3 scripts/extrair-pdf.py caminho/Catalogo_Luretec_2026.pdf [--raiz .]

Saídas (relativas à raiz do projeto):
  data/produtos.json              lista canônica de produtos (ordem do catálogo)
  public/img/produtos/<codigo>.jpg fotos dos produtos
  public/downloads/catalogo-luretec-2026.pdf cópia do PDF para download

Dependências: pymupdf (fitz) e pillow  ->  pip install pymupdf pillow

Como o layout é lido:
  - Páginas de capa de categoria têm o texto "C A T E G O R I A 0 1" + nome + descrição.
  - Páginas de produtos têm cards em grade: foto, código (5-6 dígitos, sufixo opcional "-2"),
    depois "REF. XXXX" e o nome. Cabeçalhos de grupo ("FIAT" / "25 produtos") separam montadoras.
  - A foto de um card é a imagem cuja base fica logo acima do código, na mesma coluna.
"""
import argparse
import io
import json
import os
import re
import shutil
import sys
import unicodedata

try:
    import fitz  # pymupdf
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Instale as dependências: pip install pymupdf pillow")

CODE_RE = re.compile(r"^(\d{5,6}(?:-\d)?)$")
GROUP_RE = re.compile(r"^([A-ZÁÉÍÓÚÂÊÔÃÕÇ/\.\- ]+?)\s*\n?\s*(\d+) produtos?$")
COVER_RE = re.compile(r"^C A T E G O R I A\s*((?:\d ?)+)\n(.+)$", re.S)
REF_RE = re.compile(r"^REF\.\s*(\S+)\s+(.*)$")

# Numeração do PDF -> slug usado no site. Nomes não previstos viram slug do próprio nome.
SLUG_POR_NUMERO = {
    1: "botoes", 2: "microventiladores", 3: "chicotes", 4: "led", 5: "maquinas-de-vidro",
    6: "conectores-cabos", 7: "ferramentas", 8: "estribos", 9: "automotivo",
    10: "reles-eletronicos", 11: "baterias",
}
SUBGRUPO_POR_NOME = {
    "FIAT": "fiat", "FORD": "ford", "GM": "gm", "VW": "vw", "RENAULT": "renault",
    "HONDA": "honda", "NISSAN": "nissan", "HYUNDAI/KIA": "hyundai-kia", "PEUGEOT": "peugeot",
    "TOYOTA": "toyota", "OUTROS": "outros",
}


def slugify(texto: str) -> str:
    s = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "outros"


def blocos_de_texto(page):
    return [(b[0], b[1], b[2], b[3], b[4].strip()) for b in page.get_text("blocks") if b[6] == 0]


def extrair(pdf_path: str, raiz: str) -> None:
    doc = fitz.open(pdf_path)
    # Logo: imagem repetida em quase todas as páginas (canto superior direito).
    contagem_xref = {}
    for page in doc:
        for img in page.get_images(full=True):
            contagem_xref[img[0]] = contagem_xref.get(img[0], 0) + 1
    logo_xref = max(contagem_xref, key=contagem_xref.get) if contagem_xref else None

    produtos, categorias = [], []
    cat_atual, grupo_atual = None, None
    for pno in range(doc.page_count):
        page = doc[pno]
        blocos = blocos_de_texto(page)
        for b in blocos:
            m = COVER_RE.match(b[4])
            if m:
                numero = int(m.group(1).replace(" ", ""))
                linhas = [l.strip() for l in m.group(2).split("\n") if l.strip()]
                nome = linhas[0]
                # descrição fica em outro bloco logo abaixo do título
                desc = ""
                for t in blocos:
                    if t[1] > b[3] and t[1] - b[3] < 40 and t[4] and not t[4].endswith("produtos"):
                        desc = t[4].replace("\n", " ")
                        break
                cat_atual = {"numero": numero, "id": SLUG_POR_NUMERO.get(numero, slugify(nome)),
                             "nome": nome, "descricao": desc, "pagina": pno + 1}
                categorias.append(cat_atual)
                grupo_atual = None
        imagens = []
        for img in page.get_images(full=True):
            if img[0] == logo_xref:
                continue
            try:
                imagens.append((img[0], page.get_image_bbox(img)))
            except Exception:  # imagem sem posição (máscaras etc.)
                continue
        ordenados = sorted(blocos, key=lambda b: (round(b[1] / 8), b[0]))
        for b in ordenados:
            gm = GROUP_RE.match(b[4])
            if gm:
                grupo_atual = gm.group(1).strip()
                continue
            if not CODE_RE.match(b[4]) or cat_atual is None:
                continue
            codigo = b[4]
            cx, y0 = (b[0] + b[2]) / 2, b[1]
            cand = sorted((y0 - bb.y1, x, bb) for x, bb in imagens
                          if bb.x0 - 20 <= cx <= bb.x1 + 20 and 0 <= y0 - bb.y1 <= 40)
            xref = cand[0][1] if cand else None
            abaixo = sorted((t for t in blocos if b[3] < t[1] < b[3] + 60
                             and abs((t[0] + t[2]) / 2 - cx) < 95 and not CODE_RE.match(t[4])),
                            key=lambda t: t[1])
            texto = re.sub(r"\s+", " ", " ".join(t[4].replace("\n", " ") for t in abaixo)).strip()
            ref, nome = None, texto
            m = REF_RE.match(texto)
            if m:
                ref, nome = m.group(1), m.group(2).strip()
            subgrupo = SUBGRUPO_POR_NOME.get(grupo_atual, slugify(grupo_atual)) if grupo_atual else None
            produtos.append({"codigo": codigo, "ref": ref, "nome": nome, "categoria": cat_atual["id"],
                             "subgrupo": subgrupo, "pagina": pno + 1, "_xref": xref})

    if not produtos:
        sys.exit("Nenhum produto encontrado - o layout do PDF mudou?")
    vistos = set()
    for p in produtos:
        if p["codigo"] in vistos:
            sys.exit(f"Código duplicado no PDF: {p['codigo']}")
        vistos.add(p["codigo"])

    dir_img = os.path.join(raiz, "public", "img", "produtos")
    os.makedirs(dir_img, exist_ok=True)
    for ordem, p in enumerate(produtos, start=1):
        p["ordem"] = ordem
        xref = p.pop("_xref")
        if xref is None:
            print(f"aviso: {p['codigo']} sem foto no PDF", file=sys.stderr)
            p["imagem"] = None
            continue
        info = doc.extract_image(xref)
        im = Image.open(io.BytesIO(info["image"]))
        arquivo = f"{p['codigo']}.jpg"
        if info["ext"] in ("jpeg", "jpg"):
            with open(os.path.join(dir_img, arquivo), "wb") as fh:
                fh.write(info["image"])
        else:  # converte png/outros para jpeg com fundo branco
            fundo = Image.new("RGB", im.size, (255, 255, 255))
            fundo.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[3])
            fundo.save(os.path.join(dir_img, arquivo), "JPEG", quality=88)
        p["imagem"] = {"arquivo": arquivo, "largura": im.width, "altura": im.height}

    os.makedirs(os.path.join(raiz, "data"), exist_ok=True)
    with open(os.path.join(raiz, "data", "produtos.json"), "w", encoding="utf-8") as fh:
        json.dump(produtos, fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(raiz, "public", "downloads"), exist_ok=True)
    shutil.copyfile(pdf_path, os.path.join(raiz, "public", "downloads", "catalogo-luretec-2026.pdf"))

    print(f"{len(produtos)} produtos, {len(categorias)} categorias")
    for c in categorias:
        n = sum(1 for p in produtos if p["categoria"] == c["id"])
        print(f"  {c['numero']:02d} {c['id']:<20} {n:>4}  {c['descricao']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--raiz", default=os.path.join(os.path.dirname(__file__), ".."))
    args = ap.parse_args()
    extrair(args.pdf, os.path.abspath(args.raiz))
