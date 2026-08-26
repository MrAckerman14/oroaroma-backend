<template>
  <div class="q-pa-md">
    <ModuleToolbar
      title="Mensajeros"
      subtitle="Gestiona entregas y mensajeros."
      icon="local_shipping"
      class="q-mb-md"
    >
      <template #buttons>
        <q-btn
          v-if="auth?.isAdmin"
          icon="add"
          color="yellow-9"
          text-color="black"
          :label="$q.screen.lt.sm ? 'Agregar' : 'Agregar Mensajero'"
          class="toolbar-action-button"
          @click="dialog = true"
        />
      </template>

      <template #filter>
        <messenger-filters
          v-model:filters="filters"
          @filter="filterByDate"
        />
      </template>
    </ModuleToolbar>

    <messengers-table
      :rows="rows"
      :columns="columns"
      :is-admin="auth?.isAdmin"
      :show-earned-money="showEarnedMoney"
      @edit="edit"
      @delete="openDeleteDialog"
      @view-details="openMessengerDetails"
    />

    <messenger-add-dialog
      :model-value="dialog || dialogEdit"
      v-model:form-data="data"
      :is-edit="dialogEdit"
      :loading="savingMessenger"
      @update:model-value="setMessengerDialog"
      @submit="submitMessenger"
      @reset="onReset"
    />

    <MessengerDetailDialog
      v-model="messengerDetailsDialog"
      :messenger="selectedMessenger"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="mensajero"
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

import MessengerFilters from "components/messengers/MessengerFilters.vue";
import MessengersTable from "components/messengers/MessengersTable.vue";
import MessengerAddDialog from "components/messengers/MessengerAddDialog.vue";
import MessengerDetailDialog from "components/messengers/MessengerDetailDialog.vue";
import ModuleToolbar from "components/common/ModuleToolbar.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "MessengersPage",

  components: {
    MessengerFilters,
    MessengersTable,
    MessengerAddDialog,
    MessengerDetailDialog,
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
      auth: null,
      dialog: false,
      dialogEdit: false,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,
      savingMessenger: false,
      messengerDetailsDialog: false,
      selectedMessenger: null,
      filters: {
        from: today,
        to: tomorrow,
      },
      data: {
        name: "",
        email: "",
        password: "",
        delivery_pay: "",
        money_pending: "",
        count_delivery: "",
        rol: "Mensajero",
        id: null,
      },

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
          field: "count_delivery",
          label: "Total Envio",
          sortable: true,
          align: "center",
        },
        {
          name: "delivery_pay",
          label: "Dinero ganado",
          field: "delivery_pay",
          sortable: true,
          align: "center",
        },
        {
          name: "pending_delivery_pay",
          field: "pending_delivery_pay",
          label: "Pago Pendiente",
          sortable: true,
          align: "center",
        },
        {
          name: "money_pending",
          label: "Dinero Pendiente",
          field: "money_pending",
          sortable: true,
          align: "center",
        },
      ],

      rows: [],
    };
  },

  computed: {
    columns() {
      const visibleColumns = this.showEarnedMoney
        ? this.baseColumns
        : this.baseColumns.filter((column) => column.name !== "delivery_pay");

      if (!this.auth?.isAdmin) return visibleColumns;

      return [
        ...visibleColumns,
        {
          name: "options",
          label: "Opciones",
          field: "options",
          align: "center",
        },
      ];
    },

    showEarnedMoney() {
      return Boolean(this.auth?.isAdmin || this.auth?.isMessenger);
    },
  },

  created() {
    this.auth = useAuthStore();
  },

  async mounted() {
    await this.syncSession();
    this.getUsers();
  },

  methods: {
    async syncSession() {
      try {
        const response = await api.get("/auth/me");
        const user = response.data?.user || response.data?.data?.user || response.data?.data;

        if (user && this.auth?.setSessionFromUser) {
          this.auth.setSessionFromUser(user);
        }
      } catch (error) {
        console.error("No se pudo refrescar la sesion:", error);
      }
    },

    notificationMessage(message, type) {
      Notify.create({
        type,
        message,
      });
    },

    edit(row) {
      if (!this.auth?.isAdmin) return;

      this.dialogEdit = true;

      this.data.name = row.name;
      this.data.password = row.password;
      this.data.rol = "Mensajero";
      this.data.email = row.email;
      this.data.id = row.id;
    },

    async filterByDate() {
      await this.getUsers();
    },

    async getUsers() {
      const endpoint = this.auth?.isAdmin ? "/users" : "/users/plain";

      try {
        this.rows = await this.loadMessengerRows(endpoint);
      } catch (err) {
        console.error("Error al obtener mensajeros:", err);
        this.notificationMessage(apiErrorMessage(err, "No se pudieron cargar los mensajeros"), "negative");
      }
    },

    async loadMessengerRows(endpoint) {
      const users = await listAllPages(api, endpoint, {
        from: this.filters.from,
        to: this.filters.to,
        includeStats: true,
      });

      return users
        .map(normalizeUser)
        .filter((value) => value.rol === "Mensajero")
        .filter((value) => this.auth?.isAdmin || this.hasMessengerActivity(value));
    },

    hasMessengerActivity(row) {
      return Number(row.count_delivery || 0) > 0
        || Number(row.delivery_pay || 0) > 0
        || Number(row.pending_delivery_pay || 0) > 0
        || Number(row.money_pending || 0) > 0;
    },

    async onSubmit() {
      if (!this.auth?.isAdmin) return;
      if (this.savingMessenger) return;

      if (this.accept !== true) {
        try {
          this.savingMessenger = true;
          const res = await api.post("/users", userPayload(this.data));

          console.log("📦 Respuesta del servidor:", res.data.data);

          this.notificationMessage("Agregado correctamente", "positive");

          await this.getUsers();

          this.onReset();
        } catch (err) {
          console.error("❌ Error al agregar usuarios:", err);

          this.notificationMessage(apiErrorMessage(err, "Error al agregar"), "negative");
        } finally {
          this.savingMessenger = false;
        }
      } else {
        this.notificationMessage("Error al agregar!", "negative");
      }
    },

    onReset() {
      this.accept = false;
      this.dialog = false;
      this.dialogEdit = false;

      this.data.name = "";
      this.data.email = "";
      this.data.password = "";
      this.data.rol = "Mensajero";
      this.data.delivery_pay = "";
      this.data.money_pending = "";
      this.data.count_delivery = "";
      this.data.id = null;
    },

    openDeleteDialog(value) {
      this.deleteTarget = value;
      this.deleteDialog = true;
    },

    setMessengerDialog(value) {
      if (!value) this.onReset();
    },

    async submitMessenger() {
      if (this.savingMessenger) return;

      if (this.dialogEdit) {
        await this.editEmployer();
        return;
      }

      await this.onSubmit();
    },

    openMessengerDetails(messenger) {
      this.selectedMessenger = messenger;
      this.messengerDetailsDialog = true;
    },

    async deleteEmployer() {
      if (!this.auth?.isAdmin) return;
      if (!this.deleteTarget) return;

      try {
        this.deleting = true;
        await api.delete(`/users/${this.deleteTarget.id}`);
        this.notificationMessage("Eliminado correctamente", "positive");
        await this.getUsers();
        this.deleteDialog = false;
        this.deleteTarget = null;
      } catch (err) {
        console.error("❌ Error al eliminar usuario:", err);

        this.notificationMessage(apiErrorMessage(err, "Error al eliminar"), "negative");
      } finally {
        this.deleting = false;
      }
    },

    async editEmployer() {
      if (!this.auth?.isAdmin) return;
      if (this.savingMessenger) return;

      try {
        this.savingMessenger = true;
        const id = this.data.id;

        await api.put(`/users/${id}`, userUpdatePayload(this.data));

        this.notificationMessage("Usuario Actualizado!", "positive");

        await this.getUsers();

        this.onReset();
      } catch (err) {
        console.error("❌ Error al actualizar usuario:", err);

        this.notificationMessage(apiErrorMessage(err, "Error al actualizar"), "negative");
      } finally {
        this.savingMessenger = false;
      }
    },
  },
};
</script>
