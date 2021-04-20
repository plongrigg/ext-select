import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxMatExtSelectComponent } from './ngx-mat-ext-select.component';

describe('NgxMatExtSelectComponent', () => {
  let component: NgxMatExtSelectComponent;
  let fixture: ComponentFixture<NgxMatExtSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgxMatExtSelectComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxMatExtSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
