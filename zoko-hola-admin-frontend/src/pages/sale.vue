<template>
  <div class="q-pa-md">
    <ModuleToolbar
      title="Ventas"
      subtitle="Registra y consulta las ventas del negocio."
      icon="point_of_sale"
      class="q-mb-md"
    >
      <template #buttons>
        <q-btn
          v-if="canCreateSale"
          icon="add"
          color="yellow-9"
          text-color="black"
          :label="$q.screen.lt.sm ? 'Agregar' : 'Agregar Venta'"
          class="toolbar-action-button"
          @click="dialog = true"
        />
        <q-btn
          v-if="!isSellerUser"
          icon="point_of_sale"
          outline
          color="black"
          :label="$q.screen.lt.sm ? 'Caja' : 'Cierre de Caja'"
          class="toolbar-action-button"
          @click="getReport"
        />
      </template>

      <template #filter>
        <sale-filters
          :filters="filters"
          @filter="filterByDate"
        />
      </template>
    </ModuleToolbar>

    <sales-table
      :sales="sales"
      :products="products"
      :is-admin="auth.isAdmin"
      :is-seller-user="isSellerUser"
      @edit="edit"
      @delete="openDeleteDialog"
      @view-details="openSaleDetails"
    />

    <sale-add-dialog
      v-model="dialog"
      :form-data="saleForm"
      :user-messenger="userMessenger"
      :user-employer="userEmployer"
      :user-seller="userSeller"
      :can-select-messenger="canSelectMessenger"
      :can-select-employee="canSelectEmployee"
      :can-select-seller="canSelectSeller"
      :is-seller-user="isSellerUser"
      :assigned-seller-label="assignedSellerLabel"
      @submit="onSubmit"
      @reset="onReset"
      @open-products="openProductsDialog"
    />

    <sale-edit-dialog
      v-model="dialogEdit"
      :form-data="saleForm"
      :user-messenger="userMessenger"
      :user-employer="userEmployer"
      :user-seller="userSeller"
      :can-select-messenger="canSelectMessenger"
      :can-select-employee="canSelectEmployee"
      :can-select-seller="canSelectSeller"
      :is-seller-user="isSellerUser"
      :is-admin="auth.isAdmin"
      :assigned-seller-label="assignedSellerLabel"
      :status="status"
      @submit="editSale"
      @reset="onReset"
      @open-products="openProductsDialog"
    />

    <sale-report-dialog
      v-model="dialogReportResult"
      :report="report"
      :is-admin="auth.isAdmin"
      @send-closure="sendClosure"
    />

    <sale-products-dialog
      v-model="dialogProducts"
      :products="products"
      :form-data="saleForm"
      @add-product="addProduct"
    />

    <sale-detail-dialog
      v-model="dialogSaleDetails"
      :sale="selectedSale"
      :products="products"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="venta"
      :item-name="deleteSaleLabel"
      :loading="deleting"
      @confirm="deleteSale"
    />
  </div>
</template>

<script>
import { Notify } from "quasar";
import { api } from "src/boot/axios";
import { useAuthStore } from "src/stores/auth";
import {
  apiErrorMessage,
  dataFromResponse,
  listAllPages,
  listFromResponse,
  normalizeCashSummary,
  normalizeProduct,
  normalizeSale,
  normalizeUser,
  paginationParams,
  salePayload,
} from "src/services/apiAdapters";

import SaleFilters from "components/sales/SaleFilters.vue";
import SalesTable from "components/sales/SalesTable.vue";
import SaleAddDialog from "components/sales/SaleAddDialog.vue";
import SaleEditDialog from "components/sales/SaleEditDialog.vue";
import SaleReportDialog from "components/sales/SaleReportDialog.vue";
import SaleProductsDialog from "components/sales/SaleProductsDialog.vue";
import SaleDetailDialog from "components/sales/SaleDetailDialog.vue";
import ModuleToolbar from "components/common/ModuleToolbar.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "SalePage",

  components: {
    SaleFilters,
    SalesTable,
    SaleAddDialog,
    SaleEditDialog,
    SaleReportDialog,
    SaleProductsDialog,
    SaleDetailDialog,
    ModuleToolbar,
    DeleteConfirmDialog,
  },

  data() {
    const today = new Date().toLocaleDateString("sv-SE");
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const tomorrow = date.toLocaleDateString("sv-SE");

    return {
      accept: false,
      dialog: false,
      dialogReportResult: false,
      products: [],
      sales: [],
      userEmployer: [],
      userMessenger: [],
      userSeller: [],
      auth: null,
      dialogProducts: false,
      dialogEdit: false,
      dialogSaleDetails: false,
      selectedSale: null,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,

      filters: {
        from: today,
        to: tomorrow,
      },
      saleForm: {
        amount_cash: 0,
        amount_transfer: 0,
        amount: 0,
        delivery_pay: 0,
        count_perfume: "",
        description: "",
        location_url: "",
        employee_id: "",
        messenger_id: "",
        seller_id: "",
        employeeId: "",
        messengerId: "",
        sellerId: "",
        sellerCleared: false,
        detail: [],
        phone: "",
        state: "",
        createdAt: "",
      },

      report: {
        total_sale: 0,
        total_cash: 0,
        total_trans: 0,
        total_cash_messenger: 0,
        neto_total: 0,

        detail_messenger: [],
        detail_seller: [],
        detail_employee: [],
      },
      status: ["Pendiente", "Finalizado", "Cancelado"],
    };
  },

  created() {
    this.auth = useAuthStore();
    console.log("Auth", this.auth);
  },

  computed: {
    roleName() {
      const role = String(this.auth?.role || "")
        .trim()
        .toLowerCase();
      const roles = {
        admin: "Admin",
        administrador: "Admin",
        employee: "Vendedor",
        empleado: "Vendedor",
        vendedor: "Vendedor",
        supervisor: "Supervisor",
        seller: "Colaborador",
        colaborador: "Colaborador",
        messenger: "Mensajero",
        mensajero: "Mensajero",
      };

      return roles[role] || this.auth?.role || "";
    },
    isAdminUser() {
      return this.roleName === "Admin";
    },
    isEmployeeUser() {
      return this.roleName === "Vendedor" || this.roleName === "Supervisor";
    },
    isSellerUser() {
      return this.roleName === "Colaborador";
    },
    canCreateSale() {
      return this.isAdminUser || this.isEmployeeUser;
    },
    canSelectEmployee() {
      return this.isAdminUser;
    },
    canSelectSeller() {
      return this.isAdminUser || this.isEmployeeUser;
    },
    canSelectMessenger() {
      return this.isAdminUser || this.isEmployeeUser || this.isSellerUser;
    },
    assignedSellerLabel() {
      return (
        this.saleForm.seller_id?.label ||
        this.saleForm.seller?.name ||
        this.auth?.name ||
        ""
      );
    },
    deleteSaleLabel() {
      if (!this.deleteTarget) return "";
      return this.deleteTarget.phone
        ? `Venta del contacto ${this.deleteTarget.phone}`
        : `Venta #${this.deleteTarget.id}`;
    },
  },

  async mounted() {
    await this.syncSession();
    this.getUsers();
    this.getProducts();
    this.getSales();
  },

  watch: {
    "saleForm.amount_cash": {
      handler() {
        this.updateSaleAmount();
      },
      deep: true,
    },
    "saleForm.amount_transfer": {
      handler() {
        this.updateSaleAmount();
      },
      deep: true,
    },
    "saleForm.seller_id"(value) {
      if (value === null || value === "") {
        this.saleForm.sellerId = null;
        this.saleForm.sellerCleared = true;
      }
    },
  },

  methods: {
    openSaleDetails(sale) {
      this.selectedSale = sale;
      this.dialogSaleDetails = true;
    },

    async syncSession() {
      try {
        const response = await api.get("/auth/me");
        const user =
          response.data?.user ||
          response.data?.data?.user ||
          response.data?.data;

        if (user && this.auth?.setSessionFromUser) {
          this.auth.setSessionFromUser(user);
        }
      } catch (error) {
        console.error("No se pudo refrescar la sesion:", error);
      }
    },

    notificationMessage(message, type) {
      Notify.create({ type, message });
    },

    updateSaleAmount() {
      const cash = Number(this.saleForm.amount_cash || 0);
      const transfer = Number(this.saleForm.amount_transfer || 0);
      this.saleForm.amount = cash + transfer;
    },

    currentUserOption(role) {
      const lists = {
        Vendedor: this.userEmployer,
        Supervisor: this.userEmployer,
        Colaborador: this.userSeller,
        Mensajero: this.userMessenger,
      };
      const options = lists[role] || [];

      return (
        options.find((option) => option.value === this.auth?.userId) ||
        options.find((option) => option.label === this.auth?.name) ||
        null
      );
    },

    optionFromIdOrLabel(options, id, label) {
      return (
        options.find((option) => option.value === id) ||
        options.find((option) => option.label === label) ||
        null
      );
    },

    userHasRole(user, roleKey, roleLabel) {
      const canonicalRoleKey = (value) => {
        const key = String(value || "").trim().toLowerCase();
        return key === "seller" ? "collaborator" : key;
      };

      const assignments = Array.isArray(user.roleAssignments)
        ? user.roleAssignments
        : [];
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const roleKeys = [
        user.roleKey,
        ...roles.map((role) =>
          typeof role === "string"
            ? role
            : role?.roleKey || role?.key || role?.role?.key
        ),
        ...assignments.map((assignment) => assignment.role?.key),
      ].filter(Boolean).map(canonicalRoleKey);
      const roleLabels = [
        user.rol,
        user.role,
        user.roleName,
        ...roles.map((role) =>
          typeof role === "string" ? role : role?.name || role?.role?.name
        ),
        ...assignments.map((assignment) => assignment.role?.name),
      ].filter(Boolean);

      return roleKeys.includes(canonicalRoleKey(roleKey)) || roleLabels.includes(roleLabel);
    },

    applySaleRoleDefaults() {
      if (!this.auth) return;

      if (this.auth.isSeller) {
        const seller = this.currentUserOption("Colaborador");
        if (seller) {
          this.saleForm.seller_id = seller;
          this.saleForm.sellerId = seller.value;
        }

        this.saleForm.employee_id = "";
        this.saleForm.employeeId = "";
      }

      if (this.auth.isEmployee) {
        const employee = this.currentUserOption("Vendedor") || this.currentUserOption("Supervisor");
        if (employee) {
          this.saleForm.employee_id = employee;
          this.saleForm.employeeId = employee.value;
        }
      }
    },

    edit(row) {
      this.saleForm.id = row.id;
      this.saleForm.amount = row.amount;
      this.saleForm.count_perfume = row.count_perfume;
      this.saleForm.description = row.description;
      this.saleForm.location_url = row.location_url || "";
      this.saleForm.delivery_pay = row.delivery_pay;
      this.saleForm.employeeId = row.employeeId;
      this.saleForm.messengerId = row.messengerId;
      this.saleForm.sellerId = row.sellerId;
      this.saleForm.sellerCleared = false;
      this.saleForm.employee_id = this.optionFromIdOrLabel(
        this.userEmployer,
        row.employeeId,
        row.employee_id
      );
      this.saleForm.messenger_id = this.optionFromIdOrLabel(
        this.userMessenger,
        row.messengerId,
        row.messenger_id
      );
      this.saleForm.seller_id = this.optionFromIdOrLabel(
        this.userSeller,
        row.sellerId,
        row.seller_id
      );
      this.saleForm.state = row.state;
      this.saleForm.phone = row.phone;
      this.saleForm.amount_cash = row.amount_cash;
      this.saleForm.amount_transfer = row.amount_transfer;

      // Mapear detalles con imagen
      this.saleForm.detail = row.details.map((item) => ({
        ...item,
        image_path:
          this.products.find((p) => p.id === item.store_id)?.image_path || null,
        quantity: item.count,
      }));

      this.saleForm.employee = row.employee;
      this.saleForm.messenger = row.messenger;
      this.saleForm.seller = row.seller;

      this.dialogEdit = true;
    },

    async sendClosure() {
      try {
        await api.post(
          `/cash-closures?from=${this.filters.from}&to=${this.filters.to}`,
          {}
        );

        this.dialogReportResult = false;

        this.notificationMessage("Reporte agregado!", "positive");
      } catch (err) {
        console.error("Error cerrando:", err);
        this.notificationMessage(
          apiErrorMessage(err, "Error al crear cierre"),
          "negative"
        );
      }
    },

    async filterByDate() {
      try {
        const sales = await listAllPages(api, "/sales", {
          from: this.filters.from,
          to: this.filters.to,
        });
        this.sales = sales.map(normalizeSale);
      } catch (err) {
        console.error("Error al filtrar:", err);
      }
    },

    async getReport() {
      try {
        const res = await api.get("/reports/cash-reconciliation", {
          params: { from: this.filters.from, to: this.filters.to },
        });
        this.report = normalizeCashSummary(dataFromResponse(res));

        this.dialogReportResult = true;
      } catch (err) {
        console.error("Error al obtener reporte:", err);
      }
    },

    async getUsers() {
      try {
        const users = [];
        let page = 1;
        let totalPages = 1;

        do {
          const res = await api.get("/users/plain", {
            params: paginationParams({ page }),
          });
          users.push(...listFromResponse(res));
          totalPages = Number(res?.data?.data?.pagination?.totalPages || 1);
          page += 1;
        } while (page <= totalPages);

        this.userSeller = [];
        this.userMessenger = [];
        this.userEmployer = [];
        users.map(normalizeUser).forEach((element) => {
          if (this.userHasRole(element, "collaborator", "Colaborador"))
            this.userSeller.push({ label: element.name, value: element.id });
          if (this.userHasRole(element, "messenger", "Mensajero"))
            this.userMessenger.push({ label: element.name, value: element.id });
          if (this.userHasRole(element, "employee", "Vendedor") || this.userHasRole(element, "supervisor", "Supervisor"))
            this.userEmployer.push({ label: element.name, value: element.id });
        });
        this.applySaleRoleDefaults();
      } catch (err) {
        console.error(err);
        this.notificationMessage(
          apiErrorMessage(err, "No se pudieron cargar los usuarios"),
          "negative"
        );
      }
    },

    async getProducts() {
      try {
        const products = await listAllPages(api, "/stores");
        this.products = products.map(normalizeProduct);
      } catch (err) {
        console.error(err);
        this.notificationMessage(
          apiErrorMessage(err, "No se pudieron cargar los productos"),
          "negative"
        );
      }
    },

    async openProductsDialog() {
      if (!this.products.length) {
        await this.getProducts();
      }

      if (!this.products.length) {
        this.notificationMessage(
          "No hay productos disponibles para agregar",
          "warning"
        );
        return;
      }

      this.dialogProducts = true;
    },

    async getSales() {
      try {
        const sales = await listAllPages(api, "/sales", {
          from: this.filters.from,
          to: this.filters.to,
        });
        this.sales = sales.map(normalizeSale);
      } catch (err) {
        console.error(err);
      }
    },

    async onSubmit() {
      // 🔹 Validación básica
      this.updateSaleAmount();

      if (Number(this.saleForm.amount || 0) <= 0) {
        this.notificationMessage(
          "Ingrese monto efectivo o transferencia",
          "negative"
        );
        return;
      }

      try {
        this.applySaleRoleDefaults();

        // 🔹 Calcular total de perfumes
        this.saleForm.count_perfume = this.saleForm.detail.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        await api.post("/sales", salePayload(this.saleForm));

        this.notificationMessage("Venta agregada", "positive");

        await this.getSales();
        await this.getProducts();
        this.onReset();
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "Error al agregar"),
          "negative"
        );
      }
    },

    onReset() {
      this.accept = false;
      this.dialog = false;
      this.dialogEdit = false;

      Object.assign(this.saleForm, {
        amount_cash: 0,
        amount_transfer: 0,
        amount: 0,
        delivery_pay: 0,
        count_perfume: "",
        description: "",
        location_url: "",
        employee_id: "",
        messenger_id: "",
        seller_id: "",
        employeeId: "",
        messengerId: "",
        sellerId: "",
        sellerCleared: false,
        detail: [],
        state: "",
        phone: "",
      });
      this.applySaleRoleDefaults();
    },

    openDeleteDialog(value) {
      this.deleteTarget = value;
      this.deleteDialog = true;
    },

    async deleteSale() {
      if (!this.deleteTarget) return;

      try {
        this.deleting = true;
        await api.delete(`/sales/${this.deleteTarget.id}`);
        await this.getSales();
        await this.getProducts();
        this.notificationMessage("Venta eliminada", "positive");
        this.deleteDialog = false;
        this.deleteTarget = null;
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "Error al eliminar"),
          "negative"
        );
      } finally {
        this.deleting = false;
      }
    },

    async editSale() {
      const id = this.saleForm.id;

      // 🔹 Convertir selects a IDs
      // Los IDs se normalizan en salePayload.

      // 🔹 Eliminar si son null (muy importante)
      // Los campos vacios se omiten desde el adaptador.

      // 🔹 Eliminar campo que no debe enviarse
      // No enviamos el objeto crudo al backend v2.

      try {
        await api.put(`/sales/${id}`, salePayload(this.saleForm));

        this.notificationMessage("Venta actualizada", "positive");

        await this.getSales();
        await this.getProducts();
        this.onReset();
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "Error al actualizar"),
          "negative"
        );
      }
    },

    addProduct(product) {
      if (product.stock <= 0) return;

      const existing = this.saleForm.detail.find(
        (p) => p.product_id === product.id
      );

      if (existing) {
        if (existing.quantity < product.stock) {
          existing.quantity++;
        } else {
          this.notificationMessage("No hay más stock!", "negative");
        }
      } else {
        this.saleForm.detail.push({
          product_id: product.id,
          name: product.name,
          image_path: product.image_path,
          stock: product.stock,
          quantity: 1,
        });
      }
    },
  },
};
</script>
