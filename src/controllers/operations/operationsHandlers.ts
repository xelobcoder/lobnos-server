import { Request, Response } from "express";
import Operations from "../../models/operations/operations";
import { customError, responseError, handleOverLoad } from "../../hooks/helper";
import multer from "multer";
import path from "path";
import fs from "fs";
import { NotificationDispatcher } from "../../models/application/notifications/services/NotificationDispatcher";

// Configure multer for ultrasound images
const ultrasoundStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadPath = path.join(process.cwd(), "public", "uploads", "ultrasound");
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}
		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, `ultrasound-${uniqueSuffix}${path.extname(file.originalname)}`);
	}
});

const uploadUltrasound = multer({
	storage: ultrasoundStorage,
	limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
	fileFilter: (req, file, cb) => {
		const allowedTypes = /jpeg|jpg|png|gif/;
		const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
		const mimetype = allowedTypes.test(file.mimetype);
		if (extname && mimetype) {
			return cb(null, true);
		}
		cb(new Error("Only image files are allowed!"));
	}
}).array("file", 10);

export const uploadUltrasoundImagesHandler = handleOverLoad(async (req: Request, res: Response) => {
	uploadUltrasound(req, res, async (err) => {
		if (err) {
			return customError(err.message, 400, res);
		}

		const files = req.files as Express.Multer.File[];
		if (!files || files.length === 0) {
			return customError("No files uploaded", 400, res);
		}

		const { ascensionid, testid, patientid } = req.body;
		const { tenantId } = req.query;

		if (!ascensionid || !testid || !patientid || !tenantId) {
			// Clean up uploaded files if validation fails
			files.forEach(file => fs.unlinkSync(file.path));
			return customError("ascensionid, testid, patientid and tenantId are required", 400, res);
		}

		const tId = parseInt(tenantId as string, 10);
		const uploadPromises = files.map(file =>
			Operations.uploadUltrasoundImages(tId, {
				ascensionid: parseInt(ascensionid),
				testid: parseInt(testid),
				patientid: parseInt(patientid),
				filename: file.filename
			})
		);

		const results = await Promise.all(uploadPromises);
		const successCount = results.filter(r => r).length;

		if (successCount > 0) {
			NotificationDispatcher.dispatch(
				tId,
				'IMAGING_COMPLETED',
				{
					ascensionId: parseInt(String(ascensionid), 10),
					patientId: parseInt(String(patientid), 10),
				},
			).catch(() => { });
		}

		res.send({
			statusCode: 200,
			message: `${successCount} images uploaded successfully`,
			results: files.map(f => f.filename)
		});
	});
});

export const getUltrasoundImagesHandler = handleOverLoad(async (req: Request, res: Response) => {
	try {
		const ascensionid = req.params.ascensionid as string;
		const { tenantId } = req.query;

		if (!ascensionid || !tenantId) {
			return customError("ascensionid and tenantId are required", 400, res);
		}

		const tId = parseInt(tenantId as string, 10);
		const ascId = parseInt(ascensionid);

		if (isNaN(ascId)) {
			return res.send({
				statusCode: 200,
				message: "success",
				result: []
			});
		}

		const images = await Operations.getUltrasoundImagesByAscension(tId, ascId);

		res.send({
			statusCode: 200,
			message: "success",
			result: images
		});
	} catch (err) {
		responseError(res);
	}
});

export const deleteUltrasoundImageHandler = handleOverLoad(async (req: Request, res: Response) => {
	try {
		const id = req.params.id as string;
		const { tenantId } = req.query;

		if (!id || !tenantId) {
			return customError("id and tenantId are required", 400, res);
		}

		const tId = parseInt(tenantId as string, 10);
		const imageId = parseInt(id);

		if (isNaN(imageId)) {
			return customError("Invalid image ID", 400, res);
		}

		// 1. Get image info to find filename
		const image = await Operations.getUltrasoundImageById(tId, imageId);
		if (!image) {
			return customError("Image not found", 404, res);
		}

		// 2. Delete from database
		const deleted = await Operations.deleteUltrasoundImage(tId, imageId);
		if (!deleted) {
			return customError("Failed to delete image from database", 500, res);
		}

		// 3. Delete from filesystem
		const filePath = path.join(process.cwd(), "public", "uploads", "ultrasound", image.filename);
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
			} catch (err) {
				console.error(`Failed to delete file: ${filePath}`, err);
				// We don't return error here because database record is already gone
			}
		}

		res.send({
			statusCode: 200,
			message: "Image deleted successfully"
		});
	} catch (err) {
		responseError(res);
	}
});

export const serveUltrasoundImageHandler = handleOverLoad(async (req: Request, res: Response) => {
	try {
		const filename = req.params.filename as string;
		const filePath = path.join(process.cwd(), "public", "uploads", "ultrasound", filename);

		if (fs.existsSync(filePath)) {
			res.sendFile(filePath);
		} else {
			res.status(404).send("Image not found");
		}
	} catch (err) {
		responseError(res);
	}
});

export const getAllCollections = async (req: Request, res: Response) => {
	try {
		const { departmentid, branchid, tenantId } = req.query;
		if (!departmentid || !tenantId || !branchid) return customError("departmentid, branchid or tenantId not included in request query", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const collections = new Operations(0);
		const result = await collections.getLaboratoryTestReadyForResultEntry(
			tId,
			departmentid as any,
			parseInt(branchid.toString())
		);
		res.send({ statusCode: 200, message: "success", result });
	} catch (err) {
		responseError(res);
	}
};



export const getAllEnterResult = async (req: Request, res: Response) => {
	try {
		const { tenantId } = req.query;
		if (!tenantId) return customError("tenantId not included", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const result = await new Operations(0).getAllEnterResult(tId, req.query as any);
		res.send({ result, statusCode: 200 });
	} catch (err) {
		responseError(res);
	}
};



export const getAscensionOverViewModelHandler = async (req: Request, res: Response) => {
	try {
		const { tenantId, _dateFrom, _dateEnd, patientid, billingid, testname, patientname } = req.query;
		const tId = typeof tenantId === 'string' && /^\d+$/.test(tenantId) ? Number(tenantId) : NaN;
		if (!Number.isSafeInteger(tId) || tId <= 0) return customError("Invalid tenantId", 400, res);

		// Date is required unless we are filtering by patientid or billingid
		if (!_dateFrom && !_dateEnd && !patientid && !billingid) {
			return customError("date, patientid or billingid must be included in request query", 400, res);
		}

		const result = await Operations.getAscensionOverViewModel(
			tId,
			{
				_dateFrom: _dateFrom ? _dateFrom.toString() : undefined,
				_dateEnd: _dateEnd ? _dateEnd.toString() : undefined,
				patientid: patientid ? parseInt(patientid.toString()) : undefined,
				billingid: billingid ? parseInt(billingid.toString()) : undefined,
				testname: testname ? parseInt(testname.toString()) : undefined,
				patientname: patientname ? patientname.toString() : undefined
			}
		);
		res.send({ statusCode: 200, message: "success", result });
	} catch (err) {
		responseError(res);
	}
};



export const getAscensionOverViewModelTransactionHandler = async (req: Request, res: Response) => {
	try {
		const { tenantId, billingid } = req.query;
		const tId = typeof tenantId === 'string' && /^\d+$/.test(tenantId) ? Number(tenantId) : NaN;
		if (!Number.isSafeInteger(tId) || tId <= 0) return customError("Invalid tenantId", 400, res);
		if (!billingid) return customError("billingid not included in request query", 400, res);
		const result = await Operations.getAscensionOverViewModelTransaction(tId, parseInt(billingid.toString()));
		res.send({ statusCode: 200, message: "success", result });
	} catch (err) {
		responseError(res);
	}
}

export const getAllTestPreview = async (req: Request, res: Response) => {
	try {
		const { billingid, tenantId } = req.query;
		if (!billingid || !tenantId) return customError("billingid or tenantId required", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const result = await new Operations(0).getAllTestPreview(tId, parseInt(billingid.toString()));
		res.send({ statusCode: 200, result, status: "success" });
	} catch (err) {
		responseError(res);
	}
};

export const getAllPendingCases = async (req: Request, res: Response) => {
	try {
		const { tenantId, count = 10, page = 1, departmentid, status, testid, billingid, fullname, from, to } = req.query;
		if (!tenantId) return customError("tenantId not included", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const data = { count, page, departmentid, status, testid, fullname, from, to, billingid };
		const result = await new Operations(0).getAllCasesResultEntryByMany(tId, data as any);
		res.send({ result, statusCode: 200, status: "success" });
	} catch (err) {
		responseError(res);
	}
};

export const getUltrasoundWaitingList = async (req: Request, res: Response) => {
	try {
		const { page, count, tenantId } = req.query;
		if (!tenantId) return customError("tenantId not included", 400, res);
		const tId = parseInt(tenantId as string, 10);

		const parsedCount = parseInt(count ? count.toString() || '10' : '10', 10);
		const parsedPage = parseInt(page ? page.toString() || '1' : '1', 10);
	} catch (err) {
		responseError(res);
	}
};

export const searchLaboratoryOperations = async (req: Request, res: Response) => {
	try {
		const { tenantId, page = '1', count = '10', patientId, billingId, accessionId, start_date, end_date } = req.query;
		if (!patientId && !billingId && !accessionId && !start_date && !end_date) {
			return customError("At least one search parameter is required: patientId, billingId, or accessionId", 400, res);
		}

		const tId = parseInt(tenantId as string, 10);
		const pageNum = Math.max(1, parseInt(page.toString()) || 1);
		const countNum = Math.max(1, Math.min(100, parseInt(count.toString()) || 10));

		const result = await new Operations(0).searchLaboratoryOperations(tId, {
			patientId: patientId ? parseInt(patientId.toString()) : undefined,
			billingId: billingId ? parseInt(billingId.toString()) : undefined,
			accessionId: accessionId?.toString(),
			page: pageNum,
			count: countNum,
			start_date: start_date?.toString(),
			end_date: end_date?.toString()
		});

		res.send({
			statusCode: 200,
			status: "success",
			message: "Laboratory operations search completed",
			data: result
		});
	} catch (err: any) {
		2
		return customError("Failed to retrieve laboratory operations data. Please try again later.", 500, res);
	}
};
