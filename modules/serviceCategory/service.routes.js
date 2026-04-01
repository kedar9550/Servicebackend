const express = require("express");
const router = express.Router();

const serviceController = require("./service.controller");
const protect = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/permission.middleware");


  // STATIC ROUTES FIRST


router.post(
  "/add",
  protect,
  authorize("CREATE_SERVICE"),
  serviceController.createService
);

router.get(
  "/stats",
  protect,
  authorize("VIEW_ALL_ANALYTICS"),
  serviceController.getServiceStats
);


   //NORMAL ROUTES


router.get(
  "/",
  protect,
  serviceController.getServices
);

router.get(
  "/:id",
  protect,
  serviceController.getServiceById
);

router.put(
  "/:id",
  protect,
  authorize("CREATE_SERVICE"),
  serviceController.updateService
);

router.delete(
  "/:id",
  protect,
  authorize("DELETE_SERVICE"),
  serviceController.deleteService
);


   //NESTED ROUTES

router.post(
  "/:serviceId/assign-admin",
  protect,
  authorize("MANAGE_SUBADMINS"),
  serviceController.assignAdminToService
);

router.get(
  "/:serviceId/admins",
  protect,
  authorize("MANAGE_SUBADMINS"),
  serviceController.getServiceAdmins
);

router.delete(
  "/:serviceId/admins/:userId",
  protect,
  authorize("MANAGE_SUBADMINS"),
  serviceController.removeAdmin
);

module.exports = router;