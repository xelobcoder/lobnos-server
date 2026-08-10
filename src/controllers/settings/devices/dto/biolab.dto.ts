import { z } from "zod";

export const medicalResultSchema = z.object({
     Code: z.string(),
     Name: z.string(),
     Value: z.string(),
     Unit: z.string(),
     Reference: z.string(),
     Flag: z.enum([
          "N",
          "H",
          "L",
          "HH",
          "LL",
          "A",
          "C",
     ]),
     Status: z.enum([
          "F",
          "P",
          "C",
          "X",
     ]),
     TestedAt: z.string(),
     Operator: z.string(),
});

export const bioLabInterfacingMessageSchema = z.object({
     MessageType: z.literal("ORU^R01"),

     MessageID: z.string(),

     Version: z.string(),

     PatientID: z.string(),

     PatientName: z.string(),

     SampleID: z.string(),

     Specimen: z.string(),

     CollectedAt: z.string(),

     ReportedAt: z.string(),

     Results: z.array(medicalResultSchema),
});

export type MedicalResultDto = z.infer<
     typeof medicalResultSchema
>;

export type BioLabInterfacingMessageDto = z.infer<
     typeof bioLabInterfacingMessageSchema
>;