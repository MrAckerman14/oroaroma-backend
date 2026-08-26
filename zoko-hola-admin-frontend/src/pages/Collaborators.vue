<template>
  <div class="q-pa-md">

    <!-- ========================= -->
    <!-- BOTÓN AGREGAR -->
    <!-- ========================= -->

    <!-- ========================= -->
    <!-- FILTROS -->
    <!-- ========================= -->

    <ModuleToolbar
      title="Colaboradores"
      subtitle="Gestiona colaboradores y sus resultados."
      icon="handshake"
      class="q-mb-md"
    >
      <template #buttons>
        <q-btn
          icon="add"
          color="yellow-9"
          text-color="black"
          :label="$q.screen.lt.sm ? 'Agregar' : 'Agregar Colaborador'"
          class="toolbar-action-button"
          @click="dialog = true"
        />
      </template>

      <template #filter>
      <CollaboratorsFilters
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

    <CollaboratorsTable
      :rows="rows"
      @delete="openDeleteDialog"
      @edit="edit"
      @view-details="openCollaboratorDetails"
    />

    <!-- ========================= -->
    <!-- AGREGAR COLABORADOR -->
    <!-- ========================= -->

    <CollaboratorFormDialog
      :model-value="dialog || dialogEdit"
      :data="data"
      :rols="rols"
      :is-edit="dialogEdit"
      @update:model-value="setCollaboratorDialog"
      @submit="submitCollaborator"
      @reset="onReset"
      @update:data="updateData"
    />

    <CollaboratorDetailDialog
      v-model="collaboratorDetailsDialog"
      :collaborator="selectedCollaborator"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="colaborador"
      :item-name="deleteTarget?.name"
      :loading="deleting"
      @confirm="deleteEmployer"
    />

  </div>
</template>

<script>
import { Notify } from "quasar";
import { api } from "src/boot/axios";

import {
  apiErrorMessage,
  listAllPages,
  normalizeUser,
  userPayload,
  userUpdatePayload,
} from "src/services/apiAdapters";

import CollaboratorsFilters from "src/components/collaborators/CollaboratorsFilters.vue";
import CollaboratorsTable from "src/components/collaborators/CollaboratorsTable.vue";
import CollaboratorFormDialog from "src/components/collaborators/CollaboratorFormDialog.vue";
import CollaboratorDetailDialog from "src/components/collaborators/CollaboratorDetailDialog.vue";
import ModuleToolbar from "components/common/ModuleToolbar.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "Collaborators",

  components: {
    CollaboratorsFilters,
    CollaboratorsTable,
    CollaboratorFormDialog,
    CollaboratorDetailDialog,
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
      accept: false,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,
      collaboratorDetailsDialog: false,
      selectedCollaborator: null,

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

        rol: "",

        perfume_money_pay: "",
      },

      rols: [
        "Colaborador",
      ],

      status: [
        "Activo",
        "Inactivo",
        "Bloqueado",
      ],
    };
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
        type: type,
        message: message,
      });
    },

    // =========================================================
    // ACTUALIZAR DATA DESDE LOS FORMULARIOS
    // =========================================================

    updateData(value) {
      this.data = {
        ...this.data,
        ...value,
      };
    },

    setCollaboratorDialog(value) {
      if (!value) this.onReset();
    },

    submitCollaborator() {
      if (this.dialogEdit) {
        this.editEmployer();
        return;
      }

      this.onSubmit();
    },

    openCollaboratorDetails(collaborator) {
      this.selectedCollaborator = collaborator;
      this.collaboratorDetailsDialog = true;
    },

    // =========================================================
    // EDITAR
    // =========================================================

    edit(row) {
      this.dialogEdit = true;

      this.data.name = row.name;

      this.data.password = row.password;

      this.data.rol = row.rol;

      this.data.email = row.email;

      this.data.id = row.id;
    },

    // =========================================================
    // FILTRAR POR FECHA
    // =========================================================

    async filterByDate() {
      try {
        const users = await listAllPages(
          api,
          "/users",
          {
            from: this.data.from,
            to: this.data.to,
            roleKeys: "collaborator",
          }
        );

        this.rows = users
          .map(normalizeUser)
          .filter((value) => {
            if (
              value.rol ===
              "Colaborador"
            ) {
              return value;
            }
          });
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
        const users = await listAllPages(
          api,
          "/users",
          {
            from: this.data.from,
            to: this.data.to,
            roleKeys: "collaborator",
          }
        );

        this.rows = users
          .map(normalizeUser)
          .filter((value) => {
            if (
              value.rol ===
              "Colaborador"
            ) {
              return value;
            }
          });
      } catch (err) {
        console.error(
          "Error al obtener usuarios:",
          err
        );
      }
    },

    // =========================================================
    // AGREGAR COLABORADOR
    // =========================================================

    async onSubmit() {
      if (this.accept !== true) {
        try {
          const res = await api.post(
            "/users",
            userPayload(this.data)
          );

          console.log(
            "Respuesta del servidor:",
            res.data.data
          );

          this.notificationMessage(
            "Agregado correctamente",
            "positive"
          );

          this.getUsers();

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

        this.getUsers();
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

        this.getUsers();

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
