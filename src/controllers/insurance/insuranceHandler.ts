import { Request, Response } from 'express';
import InsuranceClass from '../../models/insurance/Insurance';


export const createInsurance = async (req: Request, res: Response) => {
     try {
          const data = req.body;
          const requiredFields = [
               'insuranceName',
               'insuranceCode',
               'insuranceType',
               'network',
               'mailingAddress',
               'city',
               'state',
               'county',
               'zipCode'
          ];

          for (let field of requiredFields) {
               if (!data[field]) {
                    return res.status(400).json({ error: `Field ${field} is required` });
               }
          }

          const insurance = new InsuranceClass();
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await insurance.create(tenantId,data);

          res.status(201).json({ message: 'Insurance created successfully', insuranceId: result });
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error creating insurance record',message: error?.sqlMessage });
     }
};


export const getAllInsurances = async (req: Request, res: Response) => {
     const { page = 1, pageSize = 10 } = req.query;
     try {
          const insurance = new InsuranceClass();
          const tenantId = parseInt(req.query.tenantId.toString())
          const insurances = await insurance.getAllInsurances(tenantId,Number(page), Number(pageSize));
          res.status(200).json(insurances);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching insurance records' });
     }
};

export const getInsuranceById = async (req: Request, res: Response) => {
     const { insuranceId } = req.params;
     try {
          const insurance = new InsuranceClass(Number(insuranceId));
          const tenantId = parseInt(req.query.tenantId.toString())
          const insuranceData = await insurance.getInsuranceById(tenantId,Number(insuranceId));
          if (insuranceData) {
               res.status(200).json(insuranceData);
          } else {
               res.status(404).json({ message: 'Insurance not found' });
          }
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching insurance data' });
     }
};

export const updateInsurance = async (req: Request, res: Response) => {
     const { insuranceId } = req.params;
     const data = req.body;
     try {
          const insurance = new InsuranceClass(Number(insuranceId));
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await insurance.update(tenantId,data);
          if (result > 0) {
               res.status(200).json({ message: 'Insurance updated successfully' });
          } else {
               res.status(404).json({ message: 'Insurance not found' });
          }
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error updating insurance data' });
     }
};

export const deleteInsurance = async (req: Request, res: Response) => {
     const { insuranceId } = req.params;
     try {
          const insurance = new InsuranceClass(Number(insuranceId));
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await insurance.delete(tenantId);
          if (result > 0) {
               res.status(200).json({ message: 'Insurance deleted successfully' });
          } else {
               res.status(404).json({ message: 'Insurance not found' });
          }
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error deleting insurance record' });
     }
};
