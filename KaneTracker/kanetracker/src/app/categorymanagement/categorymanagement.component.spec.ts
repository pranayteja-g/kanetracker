import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategorymanagementComponent } from './categorymanagement.component';

describe('CategorymanagementComponent', () => {
  let component: CategorymanagementComponent;
  let fixture: ComponentFixture<CategorymanagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorymanagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategorymanagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
