import { Request, Response } from 'express';
import { BirthdayService } from './BirthdayService';


export class BirthdayHandlers {
    static async getTodaysBirthdays(req: Request, res: Response) {
        try {
            const tenantId = parseInt(req.query.tenantId as string);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const birthdayService = new BirthdayService();
            const result = await birthdayService.getTodaysBirthdays(tenantId, { page, limit });

            res.status(200).json({
                success: true,
                ...result,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    static async getUpcomingBirthdays(req: Request, res: Response) {
        try {
            const tenantId = parseInt(req.query.tenantId as string);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const birthdayService = new BirthdayService();
            const result = await birthdayService.getUpcomingBirthdays(tenantId, { page, limit });

            res.status(200).json({
                success: true,
                ...result,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    static async getWeekBirthdays(req: Request, res: Response) {
        try {
            const tenantId = parseInt(req.query.tenantId as string);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const birthdayService = new BirthdayService();
            const result = await birthdayService.getWeekBirthdays(tenantId, { page, limit });

            res.status(200).json({
                success: true,
                ...result,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    static async getMonthBirthdays(req: Request, res: Response) {
        try {
            const tenantId = parseInt(req.query.tenantId as string);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const birthdayService = new BirthdayService();
            const result = await birthdayService.getMonthBirthdays(tenantId, { page, limit });

            res.status(200).json({
                success: true,
                ...result,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    static async getAllBirthdayGroups(req: Request, res: Response) {
        try {
            const tenantId = parseInt(req.query.tenantId as string);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const birthdayService = new BirthdayService();
            const [today, upcoming, week, month] = await Promise.all([
                birthdayService.getTodaysBirthdays(tenantId, { page, limit }),
                birthdayService.getUpcomingBirthdays(tenantId, { page, limit }),
                birthdayService.getWeekBirthdays(tenantId, { page, limit }),
                birthdayService.getMonthBirthdays(tenantId, { page, limit })
            ]);

            res.status(200).json({
                success: true,
                page,
                limit,
                data: {
                    today,
                    upcoming,
                    week,
                    month
                }
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}