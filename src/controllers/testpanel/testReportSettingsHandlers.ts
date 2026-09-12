import { Request, Response } from "express";
import { customError, responseError } from "../../hooks/helper";
import TestReportSettings from "../../models/application/appsettings/result-settings/TestReportSettings";
import { ApplicationResultSettings } from "../../models/application/appsettings/interfaces/results-settings.interface";

export const getTestReportSettingsHandler = async (
     req: Request<{}, {}, {}, { tenantId: number; testid: number }>,
     res: Response
) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 400, res);
          const tenantId = parseInt(req.query.tenantId.toString());
          const parsedTestId = parseInt(testid.toString());

          const [customSettings, resolvedSettings] = await Promise.all([
               TestReportSettings.getForTest(tenantId, parsedTestId),
               TestReportSettings.resolve(tenantId, parsedTestId),
          ]);

          res.send({
               status: "success",
               isCustom: !!customSettings,
               data: typeof resolvedSettings === "boolean" ? null : resolvedSettings,
          });
     } catch (err) {
          responseError(res);
     }
};

export const putTestReportSettingsHandler = async (
     req: Request<{}, {}, { testid: number; data: ApplicationResultSettings }, { tenantId: number }>,
     res: Response
) => {
     try {
          const { testid, data } = req.body;
          if (!testid || !data) return customError("testid and data are required", 400, res);
          const tenantId = parseInt(req.query.tenantId.toString());

          const isSuccess = await TestReportSettings.upsert(tenantId, parseInt(testid.toString()), data);
          isSuccess
               ? res.send({ status: "success", message: "Test report settings updated successfully" })
               : res.send({ status: "error", message: "Test report settings update failed" });
     } catch (err) {
          responseError(res);
     }
};

export const deleteTestReportSettingsHandler = async (
     req: Request<{}, {}, {}, { tenantId: number; testid: number }>,
     res: Response
) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 400, res);
          const tenantId = parseInt(req.query.tenantId.toString());

          const isSuccess = await TestReportSettings.remove(tenantId, parseInt(testid.toString()));
          isSuccess
               ? res.send({ status: "success", message: "Reverted to general report settings" })
               : res.send({ status: "error", message: "No custom report settings found for this test" });
     } catch (err) {
          responseError(res);
     }
};
