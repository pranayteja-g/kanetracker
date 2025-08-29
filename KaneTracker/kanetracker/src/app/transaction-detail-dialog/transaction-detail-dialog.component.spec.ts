import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionDetailDialogComponent } from './transaction-detail-dialog.component';

describe('TransactionDetailDialogComponent', () => {
  let component: TransactionDetailDialogComponent;
  let fixture: ComponentFixture<TransactionDetailDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionDetailDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionDetailDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
