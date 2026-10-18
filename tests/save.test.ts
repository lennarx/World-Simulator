import { describe, expect, it } from 'vitest';
import { advanceTurn, decisionesActuales } from '../src/engine';
import { crearSave, SAVE_VERSION, validarSave } from '../src/ui/save';
import { nuevo } from './helpers';

describe('guardado', () => {
  it('ida y vuelta por JSON conserva la partida', () => {
    const s = advanceTurn(nuevo('peru', 5), decisionesActuales(nuevo('peru', 5))).state;
    const save = crearSave(s, decisionesActuales(s), [{ turno: 1, entradas: [] }]);
    const v = validarSave(JSON.parse(JSON.stringify(save)));
    expect(typeof v).not.toBe('string');
    if (typeof v !== 'string') expect(v.state).toEqual(s);
  });

  it('migra un save v1 (Fase 1) agregando relaciones, tratados y crisis', () => {
    const s = nuevo('argentina', 6);
    const v1: Record<string, unknown> = { ...s, version: 1 };
    for (const k of ['relaciones', 'relacionesBase', 'tratados', 'crisis', 'crisisMaxNivel']) delete v1[k];
    const viejo = { app: 'simulador-gobierno-sa', version: 1, savedAt: '', state: v1, draft: { ...decisionesActuales(s) }, partes: [] };
    const v = validarSave(viejo);
    expect(typeof v).not.toBe('string');
    if (typeof v === 'string') return;
    expect(v.version).toBe(SAVE_VERSION);
    expect(Object.keys(v.state.relaciones)).toHaveLength(11);
    expect(v.state.tratados).toEqual([]);
    expect(v.state.crisis).toBeNull();
    // Y se puede seguir jugando.
    expect(() => advanceTurn(v.state, decisionesActuales(v.state))).not.toThrow();
  });

  it('migra un save v2 (Fase 2) agregando guerras pasadas y sanciones', () => {
    const s = nuevo('brasil', 7);
    const v2: Record<string, unknown> = { ...s, version: 2 };
    delete v2.guerrasPasadas;
    delete v2.sanciones;
    const d: Record<string, unknown> = { ...decisionesActuales(s) };
    delete d.guerra;
    const v = validarSave({ app: 'simulador-gobierno-sa', version: 2, savedAt: '', state: v2, draft: d, partes: [] });
    expect(typeof v).not.toBe('string');
    if (typeof v === 'string') return;
    expect(v.state.guerrasPasadas).toEqual([]);
    expect(v.state.sanciones).toEqual([]);
    expect(v.draft?.guerra.declarar).toBeNull();
    expect(() => advanceTurn(v.state, v.draft!)).not.toThrow();
  });

  it('rechaza archivos ajenos o dañados', () => {
    expect(typeof validarSave({ app: 'otra-cosa' })).toBe('string');
    expect(typeof validarSave(null)).toBe('string');
    const s = nuevo();
    const roto = crearSave({ ...s, ind: { ...s.ind, inflacion: Number.NaN } }, null, []);
    expect(typeof validarSave(JSON.parse(JSON.stringify(roto)))).toBe('string');
  });

  it('migra un save v3 (Fase 3) agregando territorios vacíos', () => {
    const s = nuevo('peru', 8);
    const v3: Record<string, unknown> = { ...s, version: 3 };
    delete v3.territorios;
    const v = validarSave({ app: 'simulador-gobierno-sa', version: 3, savedAt: '', state: v3, draft: decisionesActuales(s), partes: [] });
    expect(typeof v).not.toBe('string');
    if (typeof v === 'string') return;
    expect(v.version).toBe(SAVE_VERSION);
    expect(v.state.territorios).toEqual([]);
    expect(() => advanceTurn(v.state, decisionesActuales(v.state))).not.toThrow();
  });
});
