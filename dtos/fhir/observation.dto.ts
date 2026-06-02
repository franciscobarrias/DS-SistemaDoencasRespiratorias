export interface ObservationDto {
    id: string;
    status: string;
    code: string;
    display: string;
    value: string | number;
    unit: string;
    effectiveDateTime: string;
    subject: string;
}

export {};
