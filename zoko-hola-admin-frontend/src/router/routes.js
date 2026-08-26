const routes = [
  {
    path: "/login",
    component: () => import("src/pages/login.vue"),
  },
  {
    path: "/",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("src/pages/sale.vue") }],
    meta: { roles: ["Admin", "Vendedor", "Supervisor", "Colaborador"] },
  },
  {
    path: "/vendedores",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("src/pages/Seller.vue") }],
    meta: { roles: ["Admin", "Supervisor"] },
  },
  {
    path: "/colaboradores",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("src/pages/Collaborators.vue") }],
    meta: { adminOnly: true },
  },
  {
    path: "/mensajero",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [
      { path: "", component: () => import("src/pages/messenger.vue") },
    ],
    meta: { roles: ["Admin", "Vendedor", "Supervisor", "Mensajero"] },
  },
  {
    path: "/almacen",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("src/pages/store.vue") }],
    meta: { roles: ["Admin", "Vendedor", "Supervisor", "Colaborador"] },
  },
  {
    path: "/cierre_caja",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("src/pages/CashClosures.vue") }],
    meta: { adminOnly: true },
  },
  {
    path: "/reporte_inventario",
    component: () => import("src/layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("src/pages/InventoryReport.vue") }],
    meta: { adminOnly: true },
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
