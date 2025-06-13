import { Response } from "express";
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { sendFileResponse } from "../../hooks/utility";
import {
    q_create_patient_image,
    q_find_patient_image_by_id,
    q_update_patient_image,
    q_delete_patient_image
} from './RepoPIqueries';

interface PatientImage {
    patientid: number;
    imagepath: string;
    created_at: Date;
    updated_at: Date;
}

class PatientImageRepository {
    private runqueryPromise = promisifyQuery;

    async create(tenantId: number, patientId: number, imagePath: string): Promise<boolean> {
        try {
            const result = await this.runqueryPromise(tenantId, q_create_patient_image, [patientId, imagePath]);
            return rowAffected(result);
        } catch (error) {
            logger.error(error);
            throw new Error("Failed to create patient image");
        }
    }

    async findByPatientId(tenantId: number, patientId: number): Promise<string | null> {
        try {
            const result = await this.runqueryPromise(tenantId, q_find_patient_image_by_id, [patientId]);
            return result.length > 0 ? result[0].imagepath : null;
        } catch (error) {
            logger.error(error);
            throw new Error("Failed to find patient image");
        }
    }

    async update(tenantId: number, patientId: number, imagePath: string): Promise<boolean> {
        try {
            const result = await this.runqueryPromise(tenantId, q_update_patient_image, [imagePath, patientId]);
            return rowAffected(result);
        } catch (error) {
            logger.error(error);
            throw new Error("Failed to update patient image");
        }
    }

    async delete(tenantId: number, patientId: number): Promise<boolean> {
        try {
            const result = await this.runqueryPromise(tenantId, q_delete_patient_image, [patientId]);
            return rowAffected(result);
        } catch (error) {
            logger.error(error);
            throw new Error("Failed to delete patient image");
        }
    }

    async getImage(tenantId: number, patientId: number, storagePath: string, response: Response) {
        try {
            const imagepath = await this.findByPatientId(tenantId, patientId);
            if (imagepath) {
                const filePath = `${storagePath}/${imagepath}`;
                sendFileResponse(filePath, response);
            } else {
                response.status(404).send("Image not found"); 
            }
        } catch (error) {
            logger.error(error);
            throw new Error("Failed to get patient image");
        }
    }
}

export default new PatientImageRepository();