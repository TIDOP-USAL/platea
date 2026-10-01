import { TestBed } from '@angular/core/testing';

import { CapasOffline } from './capas-offline';

describe('CapasOffline', () => {
  let service: CapasOffline;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CapasOffline);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
