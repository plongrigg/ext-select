import { AbstractControl } from '@angular/forms/forms';

/**
 * Enables or disables all controls (form propagates to child controls)
 * @param enable true to enable, false to disable
 */
export const enableControls = (control: AbstractControl, enable: boolean): void => {
  enable ? control.enable({ emitEvent: false }) : control.disable({ emitEvent: false });
};

