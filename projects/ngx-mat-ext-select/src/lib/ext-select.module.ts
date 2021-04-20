import { NgxMatExtSelectComponent } from './ext-select.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MdePopoverModule } from '@fgrid-ngx/mde';
import { NgxMatSearchboxModule } from '@fgrid-ngx/mat-searchbox';
import { MatListModule } from '@angular/material/list';
import {ScrollingModule} from '@angular/cdk/scrolling';

@NgModule({
  declarations: [
    NgxMatExtSelectComponent
  ],
  imports: [
    CommonModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    MdePopoverModule,
    MatCheckboxModule,
    MatButtonModule,
    MatInputModule,
    MatListModule,
    MatFormFieldModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    ScrollingModule,
    NgxMatSearchboxModule.forRoot()
  ],
  exports: [
    NgxMatExtSelectComponent
  ]
})
export class NgxMatExtSelectModule { }
