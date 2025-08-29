import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DexieService } from '../services/dexie.service';
import { Category } from '../models/category.interface';

@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title>{{ isEditMode ? 'Edit Category' : 'Create New Category' }}</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <form [formGroup]="categoryForm">
          <!-- Category Name -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Category Name</mat-label>
            <input matInput formControlName="name" placeholder="Enter category name" maxlength="30">
            <mat-error *ngIf="categoryForm.get('name')?.invalid">
              Category name is required (max 30 characters)
            </mat-error>
          </mat-form-field>

          <!-- Type Toggle -->
          <div class="form-section">
            <label class="form-label">Category Type</label>
            <mat-button-toggle-group formControlName="type" class="full-width">
              <mat-button-toggle value="income">
                <mat-icon>trending_up</mat-icon>
                Income
              </mat-button-toggle>
              <mat-button-toggle value="expense">
                <mat-icon>trending_down</mat-icon>
                Expense
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <!-- Color Picker -->
          <div class="form-section">
            <label class="form-label">Choose Color</label>
            <div class="color-picker-section">
              <div class="color-preview" [style.background-color]="selectedColor">
                <mat-icon *ngIf="!selectedColor">palette</mat-icon>
              </div>
              <div class="color-grid">
                <button 
                  *ngFor="let color of colorOptions" 
                  type="button"
                  class="color-option"
                  [class.selected]="selectedColor === color"
                  [style.background-color]="color"
                  (click)="selectColor(color)">
                </button>
              </div>
            </div>
            <!-- Custom Color Input -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Custom Color (Hex)</mat-label>
              <input matInput formControlName="color" placeholder="#FF5722" 
                     (input)="onColorInput($event)" pattern="^#[0-9A-Fa-f]{6}$">
              <mat-error *ngIf="categoryForm.get('color')?.invalid">
                Please enter a valid hex color (e.g., #FF5722)
              </mat-error>
            </mat-form-field>
          </div>
        </form>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" (click)="saveCategory()" [disabled]="categoryForm.invalid">
          {{ isEditMode ? 'Save Changes' : 'Create Category' }}
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./category-dialog.component.css']
})
export class CategoryDialogComponent implements OnInit {
  categoryForm!: FormGroup;
  isEditMode = false;
  selectedColor = '#2196F3';
  
  colorOptions = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
    '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B',
    '#9E9E9E', '#000000'
  ];

  constructor(
    public dialogRef: MatDialogRef<CategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category?: Category },
    private fb: FormBuilder,
    private dexieService: DexieService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.isEditMode = !!this.data?.category;
    this.initializeForm();
  }

  initializeForm() {
    const category = this.data?.category;
    
    this.categoryForm = this.fb.group({
      name: [category?.name || '', [Validators.required, Validators.maxLength(30)]],
      type: [category?.type || 'expense', Validators.required],
      color: [category?.color || '#2196F3', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]]
    });

    this.selectedColor = category?.color || '#2196F3';
  }

  selectColor(color: string) {
    this.selectedColor = color;
    this.categoryForm.patchValue({ color });
  }

  onColorInput(event: any) {
    const color = event.target.value;
    if (color && color.match(/^#[0-9A-Fa-f]{6}$/)) {
      this.selectedColor = color;
    }
  }

  async saveCategory() {
    if (this.categoryForm.valid) {
      try {
        const categoryData = this.categoryForm.value;
        
        if (this.isEditMode && this.data.category?.id) {
          await this.dexieService.updateCategory(this.data.category.id, categoryData);
          this.snackBar.open('Category updated successfully', 'Close', { duration: 2000 });
        } else {
          await this.dexieService.addCategory(categoryData);
          this.snackBar.open('Category created successfully', 'Close', { duration: 2000 });
        }
        
        this.dialogRef.close({ success: true });
      } catch (error) {
        this.snackBar.open('Failed to save category', 'Close', { duration: 3000 });
      }
    }
  }
}
