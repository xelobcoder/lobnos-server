export interface IMshSegment {
     DATE_TIME_OF_MESSAGE: string;
     FIELD_SEPARATOR: string;
     MESSAGE_CONTROL_ID: string;
     MESSAGE_TYPE: string;
     PROCESSING_ID: string;
     RECEIVING_APPLICATION: string;
     RECEIVING_FACILITY: string;
     SECURITY: string;
     SEGMENT: 'MSH';
     SENDING_APPLICATION: string;
     SENDING_FACILITY: string;
     VERSION_ID: string;
}

export interface IPidSegment {
     DATE_OF_BIRTH: string;
     DATE_OF_DEATH: string;
     DRIVERS_LICENSE_NUMBER: string;
     ETHNICITY: string;
     LANGUAGE: string;
     MARITAL_STATUS: string;
     PATIENT_ACCOUNT_NUMBER: string;
     PATIENT_ADDRESS: string;
     PATIENT_CLASS: string;
     PATIENT_ID: string;
     PATIENT_NAME: string;
     PATIENT_TYPE: string;
     PHONE_NUMBER: string;
     PLACE_OF_BIRTH: string;
     RACE: string;
     RELIGION: string;
     SEGMENT: 'PID';
     SET_ID: string;
     SEX: string;
     SSN_NUMBER: string;
}

export interface IObrSegment {
     COLLECTION_VOLUME: string;
     COLLECTOR_IDENTIFIER: string;
     FILLER_ORDER_NUMBER: string;
     OBSERVATION_DATE_TIME: string;
     OBSERVATION_END_DATE_TIME: string;
     ORDERING_PROVIDER: string;
     PLACER_ORDER_NUMBER: string;
     PRIORITY: string;
     RELEVANT_CLINICAL_INFO: string;
     REQUESTED_DATE_TIME: string;
     SEGMENT: 'OBR';
     SET_ID: string;
     SPECIMEN_ACTION_CODE: string;
     SPECIMEN_RECEIVED_DATE_TIME: string;
     SPECIMEN_SOURCE: string;
     UNIVERSAL_SERVICE_ID: string;
}

export interface IObxSegment {
     ABNORMAL_FLAGS: string;
     OBSERVATION_DATE_TIME: string;
     OBSERVATION_ID: string;
     OBSERVATION_SUB_ID: string;
     OBSERVATION_VALUE: string;
     REFERENCE_RANGE: string;
     RESULT_STATUS: string;
     SEGMENT: 'OBX';
     SET_ID: string;
     UNITS: string;
     VALUE_TYPE: string;
}
