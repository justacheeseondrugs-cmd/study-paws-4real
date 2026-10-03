export const BRAIN_VERSION='1.0';

export const GLOBAL_BRAIN={
  learningGoal:['UNDERSTAND','MEMORIZE','APPLY','DEFEND'],
  defaultFlow:['big_picture','causal_explanation','structured_guide','close_source','reconstruct','active_recall','application','targeted_feedback','retry'],
  explanation:{
    prefer:['causal','step_by_step','clinically_connected','visible_structure'],
    chain:['what_is_it','normal_state','what_changes','why_it_changes','consequences','clinical_expression','how_to_detect_it','what_decision_changes'],
    avoid:['isolated_lists','tables_as_primary_teaching','superficial_high_yield','unprioritized_information','difficult_cases_before_framework']
  },
  sources:{preserveProvenance:true,neverFlattenAllSources:true,neverSilentlyResolveDisagreements:true,externalOnlyWhenUseful:true},
  recall:{afterLearning:true,progression:['recall','explain','apply','integrate','defend']},
  feedback:{repair:['what_was_correct','missing_piece','conceptual_error','minimal_repair','verification_question']},
  mastery:{neverMasteredBecauseRead:true,dimensions:['understand','recall','apply','defend']},
  stuckMode:['stop_new_information','restore_big_picture','reduce_to_one_problem','locate_first_broken_link','minimal_hint','reconstruct','repair_gap','retry','mini_case']
};

export const COURSE_BRAINS={
  interna_materia:{
    id:'interna_materia',label:'Medicina Interna · Materia',icon:'🫀',role:'internal_medicine_exam_tutor',
    sourcePriority:{transcript:100,ppt:95,pdf:95,guide:85,book:65,other:45},
    guideFlow:['short_big_picture','real_class_structure','pathophysiology','clinical_features_from_mechanism','tests_what_why_what_changes','diagnosis_and_differentials','treatment_and_why','key_doses_and_contraindications','follow_up','exam_traps','professor_followups','mini_cases']
  },
  interna_practica:{
    id:'interna_practica',label:'Medicina Interna · Práctica',icon:'🩺',role:'clinical_reasoning_tutor',
    sourcePriority:{guide:100,transcript:90,pdf:85,ppt:80,book:70,other:45},
    guideFlow:['patient_presentation','main_problem','syndrome','severity_and_urgency','dangerous_differentials','targeted_history','targeted_physical_exam','tests_and_purpose','interpretation','initial_management','treatment','reassessment','follow_up_or_referral']
  },
  farmacologia:{
    id:'farmacologia',label:'Farmacología',icon:'💊',role:'pharmacology_clinical_tutor',
    sourcePriority:{transcript:100,ppt:98,pdf:98,guide:78,book:68,other:45},
    guideFlow:['clinical_problem','pharmacologic_target','mechanism','physiologic_change','clinical_effect','indication_and_choice','dose_route_interval','pharmacokinetics','metabolism_elimination','adverse_effects_from_mechanism','contraindications','interactions','monitoring','comparison_and_alternative'],
    understand:['mechanisms','choice_logic','adverse_effect_reasoning','interactions','contraindication_logic'],
    memorize:['doses','intervals','half_lives','important_cyps','monitoring_values','exceptions']
  }
};

export function getBrain(preset='interna_materia'){
  return {version:BRAIN_VERSION,global:GLOBAL_BRAIN,course:COURSE_BRAINS[preset]||COURSE_BRAINS.interna_materia};
}
export function inferPresetForSubject(name=''){
  const n=name.toLowerCase();
  if(/farm/.test(n)) return 'farmacologia';
  if(/pr[aá]ctica/.test(n)&&/interna/.test(n)) return 'interna_practica';
  if(/interna/.test(n)) return 'interna_materia';
  return 'interna_materia';
}
