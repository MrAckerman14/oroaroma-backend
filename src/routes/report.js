import { Router } from "express";
import { authenticationMiddleware  } from "@/middleware";
import { report_cash_reconciliation, 
         reportClosure, 
         getClosureDetails, 
         updateClosureStatus,
         getGeneralInventoryReport, 
         saveInventoryReport,
         getInventoryReports,
         getInventoryReportById } from "@/controllers/report";

const route = Router();

route.get('/cash-reconciliation', authenticationMiddleware, report_cash_reconciliation);
route.get('/cash-closure', authenticationMiddleware, reportClosure)
route.get('/cash-closure/:id', authenticationMiddleware, getClosureDetails);
route.put('/cash-closure/:id/status', updateClosureStatus)
route.get('/general-inventory/review', getGeneralInventoryReport)
route.get('/general-inventory', saveInventoryReport)
route.get('/general-inventory/report', getInventoryReports)
route.get('/general-inventory/:id', getInventoryReportById)
// route.put('/update/:id', authenticationMiddleware, updateUser);
// route.get('/create-admin', createAdminUser);

export default route;