import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import logger from "../../../hooks/logger";
import { insertCompanyProfile, truncateCompanyProfile, getAllCompanyProfiles } from "../../../models/settings/companyProfile";
import { OperationsFailures } from "../../../models/operations/types";
import { uploadImageFile } from "./imageUpload";
import { customError, responseError } from "../../../hooks/helper";

export const AddCompanyInfoHandler = async (request: Request<{},{},{name:string,motto:string,email:string,phonenumber:string|number},{tenantId:string|number}>, response: Response) => {
	try {
		const { name, motto, email, phonenumber } = request.body;
		const tenantId = parseInt(request.query.tenantId.toString());
		const hasNecessaryRequestBodyParams = name && motto && email && phonenumber;
		if (!hasNecessaryRequestBodyParams) return customError(OperationsFailures.invalidRequestBodyType + ". Necessary request body params not included", 400, response);
		await insertCompanyProfile(tenantId, request.body as any);
		return response.send({ status: "success" });
	} catch (err:any) {
		console.log(err)
		return responseError(response);
	}
};

export const getCompanyInfoHandler = async (request: Request, response: Response): Promise<void> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		let result = await getAllCompanyProfiles(tenantId);
		response.send(result);
	} catch (err:any) {
		responseError(response);
	}
};

export const getCompanyImageHandler = async (request: Request, response: Response): Promise<void> => {
	try {
		const folderPath = path.resolve(process.cwd(), "dist", "asserts", "company");
		if (!fs.existsSync(folderPath)) {
			fs.mkdirSync(folderPath, { recursive: true });
		}
		const files = fs.readdirSync(folderPath);
		const imageFile = files.find((file) => [".jpg", ".jpeg", ".png", ".gif"].includes(path.extname(file).toLowerCase()));

		if (imageFile) {
			const imagePath = path.join(folderPath, imageFile);
			const image = fs.readFileSync(imagePath);
			response.setHeader("Content-Type", "image/jpeg");
			response.setHeader("Content-Length", image.length.toString());
			response.send(image);
		} else {
			response.status(404).send("Image not found");
		}
	} catch (error) {
		logger.error(error);
		response.status(500).send("Internal Server Error");
	}
};



export const handleUploadCompanyImage = async (request: Request, response: Response): Promise<void> => {
	const destinationDir = path.resolve(process.cwd(), 'dist', 'asserts', 'company');
	if (!fs.existsSync(destinationDir)) {
		fs.mkdirSync(destinationDir, { recursive: true });
	}
	const field = "file";
	try {
		// Remove existing images before uploading new one
		const files = fs.readdirSync(destinationDir);
		files.forEach(file => {
			if ([".jpg", ".jpeg", ".png", ".gif"].includes(path.extname(file).toLowerCase())) {
				fs.unlinkSync(path.join(destinationDir, file));
			}
		});

		const uploadResult = await uploadImageFile(request, response, destinationDir, field);

		if (uploadResult) {
			response.status(200).json({
				status: "success",
				message: "Company image uploaded successfully",
			});
		} else {
			response.status(400).json({
				status: "error",
				message: "No image uploaded or invalid file type",
			});
		}
	} catch (error) {
		console.log(error);
		response.status(500).json({
			status: "error",
			message: "Failed to upload image",
		});
	}
};
