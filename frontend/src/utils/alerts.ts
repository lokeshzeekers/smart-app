/** Alert kinds the manikin raises (same moments its buzzer sounds). */
export type AlertKind =
  | 'wrong_path'
  | 'correct_path'
  | 'teeth_contact'
  | 'over_depth'
  | 'end_point'
  | 'process_complete'
  | 'head_position';

export interface LiveAlert {
  id: string;
  kind: AlertKind;
  created_at: string;
}

export const ALERT_INFO: Record<AlertKind, { label: string; tone: 'bad' | 'good' }> = {
  wrong_path: { label: 'Wrong path - tube is in the food pipe (oesophagus)', tone: 'bad' },
  correct_path: { label: 'Correct path - tube is in the airway (lungs)', tone: 'good' },
  teeth_contact: { label: 'Pressure on teeth', tone: 'bad' },
  over_depth: { label: 'Tube inserted too deep', tone: 'bad' },
  end_point: { label: 'Tube at the designated depth', tone: 'good' },
  process_complete: { label: 'Stylet removed - procedure complete', tone: 'good' },
  head_position: { label: 'Neck is not in the sniffing position', tone: 'bad' },
};
