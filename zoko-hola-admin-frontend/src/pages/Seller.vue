SELLER
<template>
  <div class="q-pa-md">

    <!-- ========================= -->
    <!-- BOTÓN AGREGAR USUARIO -->
    <!-- ========================= -->

    <!-- ========================= -->
    <!-- FILTROS -->
    <!-- ========================= -->

    <ModuleToolbar
      title="Vendedores"
      subtitle="Gestiona vendedores y sus resultados."
      icon="groups"
      class="q-mb-md"
    >
      <template #buttons>
        <q-btn
          v-if="auth?.isAdmin"
          icon="add"
          color="yellow-9"
          text-color="black"
          :label="$q.screen.lt.sm ? 'Agregar' : 'Agregar Vendedor'"
          class="toolbar-action-button"
          @click="dialog = true"
        />
      </template>

      <template #filter>
      <SellerFilters
        :from="data.from"
        :to="data.to"
        @update:from="data.from = $event"
        @update:to="data.to = $event"
        @filter="filterByDate"
      />
      </template>
    </ModuleToolbar>

    <!-- ========================= -->
    <!-- TABLA -->
    <!-- ========================= -->

    <SellerTable
      :rows="rows"
      :columns="columns"
      :is-admin="auth?.isAdmin"
      @delete="openDeleteDialog"
      @edit="edit"
      @view-details="openSellerDetails"
    />

    <!-- ========================= -->
    <!-- AGREGAR USUARIO -->
    <!-- ========================= -->

    <SellerFormDialog
      :model-value="dialog || dialogEdit"
      :data="data"
      :rols="rols"
      :is-edit="dialogEdit"
      @update:model-value="setSellerDialog"
      @submit="submitSeller"
      @reset="onReset"
      @update:data="updateData"
    />

    <SellerDetailDialog
      v-model="sellerDetailsDialog"
      :seller="selectedSeller"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="vendedor"
      :item-name="deleteTarget?.name"
      :loading="deleting"
      @confirm="deleteEmployer"
    />

  </div>
</template>

<script>
import { Notify } from "quasar";
import { api } from "src/boot/axios";
import { useAuthStore } from "src/stores/auth";

import {
  apiErrorMessage,
  listAllPages,
  normalizeUser,
  userPayload,
  userUpdatePayload,
} from "src/services/apiAdapters";

import SellerFilters from "src/components/seller/SellerFilters.vue";
import SellerTable from "src/components/seller/SellerTable.vue";
import SellerFormDialog from "src/components/seller/SellerFormDialog.vue";
import SellerDetailDialog from "src/components/seller/SellerDetailDialog.vue";
import ModuleToolbar from "components/common/ModuleToolbar.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "UsersEmployees",

  components: {
    SellerFilters,
    SellerTable,
    SellerFormDialog,
    SellerDetailDialog,
    ModuleToolbar,
    DeleteConfirmDialog,
  },

  data() {
    const todayStr =
      new Date().toLocaleDateString("sv-SE");

    const date = new Date();

    date.setDate(date.getDate() + 1);

    const tomorrowStr =
      date.toLocaleDateString("sv-SE");

    return {
      auth: null,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,
      sellerDetailsDialog: false,
      selectedSeller: null,

      accept: false,

      dialog: false,

      dialogEdit: false,

      rows: [],

      data: {
        id: null,

        from: todayStr,

        to: tomorrowStr,

        name: "",

        email: "",

        password: "",

        count_delivery: 0,

        money_delivery: "",

        count_perfum: 0,

        cash_perfume: 0,

        rol: "",
      },

      rols: [
        "Vendedor",
        "Supervisor",
      ],

      baseColumns: [
        {
          name: "name",

          required: true,

          label: "Nombre",

          align: "center",

          field: (row) => row.name,

          format: (val) => `${val}`,

          sortable: true,
        },

        {
          name: "count_delivery",

          label: "Cantid. envíos",

          field: "count_delivery",

          align: "center",
          sortable: true,
        },

        {
          name: "average",

          label: "Promedio",

          field: "average",

          align: "center",
          sortable: true,
        },

        {
          name: "count_perfum",

          label: "Cantid. perfumes",

          field: "count_perfum",

          align: "center",
          sortable: true,
        },

        {
          name: "cash_total",

          label: "Efectivo",

          field: "cash_total",

          align: "center",
          sortable: true,
        },

        {
          name: "transfer_total",

          label: "Transferencia",

          field: "transfer_total",

          align: "center",
          sortable: true,
        },

        {
          name: "money_delivery",

          label: "Mensajería",

          field: "money_delivery",

          align: "center",
          sortable: true,
        },

        {
          name: "net_total",

          label: "Neto",

          field: "net_total",

          align: "center",
          sortable: true,
        },
      ],

      actionColumn: {
        name: "actions",

        label: "Opciones",

        field: "actions",

        align: "center",
      },
    };
  },

  computed: {
    columns() {
      return this.auth?.isAdmin
        ? [
            ...this.baseColumns,
            this.actionColumn,
          ]
        : this.baseColumns;
    },
  },

  created() {
    this.auth = useAuthStore();
  },

  mounted() {
    this.getUsers();
  },

  methods: {
    // =========================================================
    // NOTIFICACIONES
    // =========================================================

    notificationMessage(message, type) {
      Notify.create({
        type,
        message,
      });
    },

    // =========================================================
    // ACTUALIZAR DATA DESDE COMPONENTES
    // =========================================================

    updateData(value) {
      this.data = {
        ...this.data,
        ...value,
      };
    },

    setSellerDialog(value) {
      if (!value) this.onReset();
    },

    submitSeller() {
      if (this.dialogEdit) {
        this.editEmployer();
        return;
      }

      this.onSubmit();
    },

    openSellerDetails(seller) {
      this.selectedSeller = seller;
      this.sellerDetailsDialog = true;
    },

    // =========================================================
    // EDITAR
    // =========================================================

    edit(row) {
      this.dialogEdit = true;

      this.data.name = row.name;

      this.data.password =
        row.password;

      this.data.rol = row.rol;

      this.data.email = row.email;

      this.data.id = row.id;
    },

    // =========================================================
    // VALIDAR ROL
    // =========================================================

    isEmployeeListRole(user) {
      return (
        [
          "employee",
          "supervisor",
        ].includes(
          String(
            user.role_key ||
              user.roleKey ||
              ""
          ).toLowerCase()
        ) ||
        [
          "Vendedor",
          "Supervisor",
        ].includes(user.rol)
      );
    },

    // =========================================================
    // FILTRAR POR FECHA
    // =========================================================

    async filterByDate() {
      try {
        const users =
          await listAllPages(
            api,
            "/users",
            {
              from: this.data.from,

              to: this.data.to,

              roleKeys:
                "employee,supervisor",
            }
          );

        this.rows = users
          .map(normalizeUser)
          .filter(
            this.isEmployeeListRole
          );
      } catch (err) {
        console.error(
          "Error al obtener usuarios:",
          err
        );
      }
    },

    // =========================================================
    // OBTENER USUARIOS
    // =========================================================

    async getUsers() {
      try {
        const users =
          await listAllPages(
            api,
            "/users",
            {
              from: this.data.from,

              to: this.data.to,

              roleKeys:
                "employee,supervisor",
            }
          );

        this.rows = users
          .map(normalizeUser)
          .filter(
            this.isEmployeeListRole
          );
      } catch (err) {
        console.error(
          "Error al obtener usuarios:",
          err
        );
      }
    },

    // =========================================================
    // AGREGAR USUARIO
    // =========================================================

    async onSubmit() {
      if (this.accept !== true) {
        try {
          await api.post(
            "/users",
            userPayload(this.data)
          );

          

          this.notificationMessage(
            "Agregado correctamente",
            "positive"
          );

          await this.getUsers();

          this.onReset();
        } catch (err) {
          console.error(
            "Error al agregar usuarios:",
            err
          );

          this.notificationMessage(
            apiErrorMessage(
              err,
              "Error al agregar"
            ),
            "negative"
          );
        }
      } else {
        this.notificationMessage(
          "Error al agregar!",
          "negative"
        );
      }
    },

    // =========================================================
    // RESET
    // =========================================================

    onReset() {
      this.accept = false;

      this.dialog = false;

      this.data.name = "";

      this.data.email = "";

      this.data.password = "";

      this.data.rol = "";

      this.dialogEdit = false;
    },

    // =========================================================
    // ELIMINAR
    // =========================================================

    openDeleteDialog(value) {
      this.deleteTarget = value;
      this.deleteDialog = true;
    },

    async deleteEmployer() {
      if (!this.deleteTarget) return;

      try {
        this.deleting = true;
        await api.delete(
          `/users/${this.deleteTarget.id}`
        );

        this.notificationMessage(
          "Eliminado correctamente",
          "positive"
        );

        await this.getUsers();
        this.deleteDialog = false;
        this.deleteTarget = null;
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(
            err,
            "Error al eliminar"
          ),
          "negative"
        );
      } finally {
        this.deleting = false;
      }
    },

    // =========================================================
    // EDITAR USUARIO
    // =========================================================

    async editEmployer() {
      const id = this.data.id;

      try {
        await api.put(
          `/users/${id}`,
          userUpdatePayload(this.data)
        );

        this.notificationMessage(
          "Usuario Actualizado!",
          "positive"
        );

        await this.getUsers();

        this.onReset();
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(
            err,
            "Error al actualizar"
          ),
          "negative"
        );
      }
    },
  },
};
</script>
