import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { NgxMatSearchboxModule } from '@fgrid-ngx/mat-searchbox';
import { MdePopoverModule } from '@fgrid-ngx/mde';
import { ScrollerDirective } from './ext-select-scroller.directive';
import { NgxMatExtSelectComponent } from './ext-select.component';

@NgModule({
  declarations: [
    NgxMatExtSelectComponent,
    ScrollerDirective
  ],
  imports: [
    CommonModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    MdePopoverModule,
    MatButtonModule,
    MatInputModule,
    MatListModule,
    MatFormFieldModule,
    MatIconModule,
    ScrollingModule,
    NgxMatSearchboxModule.forRoot(),
  ],
  exports: [
    NgxMatExtSelectComponent
  ]
})
export class NgxMatExtSelectModule { }
