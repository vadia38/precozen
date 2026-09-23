// Fila de tarefas do painel: executa comandos em processos filhos (um por vez), guarda o log e avisa ouvintes (SSE).
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

const LIMITE_LOG = 4000;
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

function agora() {
  return new Date().toISOString();
}

export class FilaTarefas extends EventEmitter {
  constructor({ maximo = 80 } = {}) {
    super();
    this.tarefas = [];
    this.maximo = maximo;
    this.atual = null;
    this.processo = null;
  }

  /**
   * Enfileira uma tarefa. passos: [{ comando, args, cwd, env?, exibir? }] executados em sequência; parada no primeiro erro.
   * notas: linhas gravadas no log antes do primeiro passo (avisos de ambiente, por exemplo).
   */
  criar({ nome, acao = null, opcoes = {}, passos, notas = [] }) {
    if (!Array.isArray(passos) || !passos.length) throw new Error('tarefa sem passos');
    const tarefa = {
      id: crypto.randomBytes(6).toString('hex'), nome: String(nome || acao || 'tarefa'), acao, opcoes, estado: 'fila',
      criadoEm: agora(), inicioEm: null, fimEm: null, codigo: null, passo: 0, totalPassos: passos.length,
      comandos: passos.map((p) => p.exibir || [p.comando, ...(p.args || [])].join(' ')), log: [], erro: null, _passos: passos,
    };
    for (const n of notas) tarefa.log.push(String(n));
    this.tarefas.push(tarefa);
    while (this.tarefas.length > this.maximo) {
      const i = this.tarefas.findIndex((t) => t.estado !== 'fila' && t.estado !== 'executando' && t.estado !== 'cancelando');
      if (i < 0) break;
      this.tarefas.splice(i, 1);
    }
    this._emitir(tarefa);
    queueMicrotask(() => this._proxima());
    return this.resumo(tarefa);
  }

  resumo(t) {
    const { _passos, log, ...resto } = t;
    return { ...resto, linhas: log.length };
  }

  listar() {
    return this.tarefas.map((t) => this.resumo(t)).reverse();
  }

  obter(id) {
    const t = this.tarefas.find((x) => x.id === id);
    return t ? { ...this.resumo(t), log: t.log } : null;
  }

  ativa() {
    return this.atual ? this.resumo(this.atual) : null;
  }

  cancelar(id) {
    const t = this.tarefas.find((x) => x.id === id);
    if (!t) return null;
    if (t.estado === 'fila') {
      t.estado = 'cancelada'; t.fimEm = agora(); t.erro = 'cancelada antes de iniciar';
      this._emitir(t);
    } else if (t.estado === 'executando' && this.processo) {
      t.estado = 'cancelando';
      this._emitir(t);
      const proc = this.processo;
      try { proc.kill('SIGTERM'); } catch { /* já encerrado */ }
      setTimeout(() => { if (this.processo === proc) { try { proc.kill('SIGKILL'); } catch { /* já encerrado */ } } }, 5000).unref();
    }
    return this.resumo(t);
  }

  /** Espera a tarefa terminar (para testes e scripts). */
  esperar(id, { timeoutMs = 120_000 } = {}) {
    return new Promise((resolve, reject) => {
      const pronta = () => { const t = this.obter(id); return t && !['fila', 'executando', 'cancelando'].includes(t.estado) ? t : null; };
      const ja = pronta();
      if (ja) return resolve(ja);
      const timer = setTimeout(() => { this.off('tarefa', ouvinte); reject(new Error(`tarefa ${id} não terminou em ${timeoutMs} ms`)); }, timeoutMs);
      const ouvinte = (t) => { if (t.id !== id) return; const r = pronta(); if (r) { clearTimeout(timer); this.off('tarefa', ouvinte); resolve(r); } };
      this.on('tarefa', ouvinte);
    });
  }

  _emitir(t) {
    this.emit('tarefa', this.resumo(t));
  }

  _log(t, linha) {
    const l = String(linha).replace(ANSI, '');
    t.log.push(l);
    if (t.log.length > LIMITE_LOG) t.log.splice(0, t.log.length - LIMITE_LOG);
    this.emit('log', { id: t.id, linha: l });
  }

  _proxima() {
    if (this.atual) return;
    const t = this.tarefas.find((x) => x.estado === 'fila');
    if (!t) return;
    this.atual = t;
    t.estado = 'executando';
    t.inicioEm = agora();
    this._emitir(t);
    this._executarPasso(t, 0);
  }

  _executarPasso(t, i) {
    if (i >= t._passos.length) return this._concluir(t, 0);
    const p = t._passos[i];
    t.passo = i + 1;
    this._emitir(t);
    this._log(t, `$ ${t.comandos[i]}`);
    let filho;
    try {
      filho = spawn(p.comando, p.args || [], { cwd: p.cwd, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ...(p.env || {}) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      this._log(t, `erro ao iniciar: ${e.message}`);
      return this._concluir(t, -1, e.message);
    }
    this.processo = filho;
    let falha = null;
    const ler = (fluxo) => {
      let resto = '';
      fluxo.setEncoding('utf8');
      fluxo.on('data', (pedaco) => {
        resto += pedaco;
        const partes = resto.split(/\r?\n/);
        resto = partes.pop();
        for (const l of partes) this._log(t, l);
      });
      fluxo.on('end', () => { if (resto.trim()) this._log(t, resto); });
    };
    ler(filho.stdout);
    ler(filho.stderr);
    filho.on('error', (e) => { falha = e.message; this._log(t, `erro: ${e.message}`); });
    filho.on('close', (codigo, sinal) => {
      if (this.processo === filho) this.processo = null;
      if (t.estado === 'cancelando') return this._concluir(t, codigo ?? -1, 'cancelada pelo usuário', 'cancelada');
      if (falha) return this._concluir(t, codigo ?? -1, falha);
      if (codigo !== 0) return this._concluir(t, codigo ?? -1, sinal ? `encerrado por ${sinal}` : `saiu com código ${codigo}`);
      this._executarPasso(t, i + 1);
    });
  }

  _concluir(t, codigo, erro = null, estado) {
    t.codigo = codigo;
    t.erro = erro;
    t.estado = estado || (codigo === 0 ? 'ok' : 'erro');
    t.fimEm = agora();
    if (this.atual === t) this.atual = null;
    this._emitir(t);
    queueMicrotask(() => this._proxima());
  }
}
