import multer from "multer";
import path from "path";
import { Request, Response } from "express";

const configureMulterStorage = (destinationDir: string) => {
	return multer.diskStorage({
		destination: (req, file, cb) => {
			const folderPath = path.isAbsolute(destinationDir)
				? destinationDir
				: path.join(__dirname, "..", destinationDir);
			cb(null, folderPath);
		},
		filename: (req, file, cb) => {
			const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
			cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
		},
	});
};

const fileFilter = (req: Request, file, cb: multer.FileFilterCallback) => {
	const isAllowedMimeType = ['image/jpeg', 'image/png'].includes(file.mimetype);
	const isAllowedExtname = ['.jpeg', '.jpg', '.png'].includes(path.extname(file.originalname).toLowerCase());

	if (isAllowedMimeType && isAllowedExtname) {
		cb(null, true);
	} else {
		cb(new Error("Only JPEG and PNG files are allowed"));
	}
};

export const uploadImageFile = async (
	request: Request,
	response: Response,
	destinationDir: string,
	field: string
): Promise<boolean | null> => {
	const upload = multer({
		storage: configureMulterStorage(destinationDir),
		fileFilter,
		limits: { fileSize: 5 * 1024 * 1024 },
	}).single(field);

	try {
		return new Promise<boolean | null>((resolve, reject) => {
			upload(request, response, (err) => {
				if (err) {
					reject(err);
				} else if (!request.file) {
					resolve(null);
				} else {
					resolve(true);
				}
			});
		});
	} catch (error) {
		return null;
	}
};
