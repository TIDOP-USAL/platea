import { TestBed } from '@angular/core/testing';

import { CapasDiputacion } from './capas-diputacion';

describe('CapasDiputacion', () => {
  let service: CapasDiputacion;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CapasDiputacion);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
