import { describe, expect, it } from 'vitest';
import { situacionPais } from '../../src/engine';
import { capacidadPais } from '../../src/engine/war';
import { nuevo } from '../helpers';

describe('situacionPais', () => {
  it('refleja relación, vecindad, tratados, crisis y guerra', () => {
    const s = nuevo('argentina');
    s.relaciones.chile = -40;
    s.tratados.push({ tipo: 'comercio', con: 'chile', desde: 0 });
    s.crisis = { con: 'chile', nivel: 2, turnos: 1 };
    const sit = situacionPais(s, 'chile');
    expect(sit).toMatchObject({ esJugador: false, relacion: -40, vecino: true, tratados: ['comercio'], crisis: 2, guerra: false });
    expect(sit.capacidad).toBe(capacidadPais('chile'));

    const otro = situacionPais(s, 'venezuela');
    expect(otro).toMatchObject({ vecino: false, tratados: [], crisis: null, guerra: false });
  });

  it('el propio país usa la capacidad militar de los indicadores', () => {
    const s = nuevo('brasil');
    const sit = situacionPais(s, 'brasil');
    expect(sit.esJugador).toBe(true);
    expect(sit.relacion).toBe(0);
    expect(sit.capacidad).toBe(s.ind.capacidadMilitar);
  });

  it('no muta el estado', () => {
    const s = nuevo('peru');
    const antes = JSON.stringify(s);
    situacionPais(s, 'chile');
    expect(JSON.stringify(s)).toBe(antes);
  });
});
