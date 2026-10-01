import { TestBed } from '@angular/core/testing';

import { CapasOnline } from './capas-online';

describe('CapasOnline', () => {
  let service: CapasOnline;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CapasOnline);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
