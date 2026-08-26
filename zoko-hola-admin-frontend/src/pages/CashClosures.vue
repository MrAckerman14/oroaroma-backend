
<template>
  <div>
    <q-page class="q-pa-md">
      <!-- ========================= -->
      <!-- FILTROS -->
      <!-- ========================= -->

      <ModuleToolbar
        title="Cierres de caja"
        subtitle="Consulta y administra los cierres de caja."
        icon="account_balance_wallet"
        class="q-mb-md"
      >
        <template #filter>
        <CashClosuresFilters
          :from="from"
          :to="to"
          @update:from="from = $event"
          @update:to="to = $event"
          @filter="filterByDate"
        />
        </template>
      </ModuleToolbar>

      <!-- ========================= -->
      <!-- TABLA PRINCIPAL -->
      <!-- ========================= -->

      <CashClosuresTable
        :closures="closures"
        @open="openClosure"
        @change-status="changeStatus"
        @edit="editClosure"
        @delete="openDeleteDialog"
      />
    </q-page>

    <!-- ========================= -->
    <!-- DETALLE DEL CIERRE -->
    <!-- ========================= -->

    <ClosureDetailDialog
      v-model="closureDialog"
      :closure-data="closureData"
      :total-pending="totalPending"
      :total-pay-messenger="totalPayMessenger"
    />

    <ReportMetadataDialog
      v-model="metadataDialog"
      title="Editar cierre de caja"
      :report="selectedClosure"
      :loading="metadataSaving"
      @submit="saveClosureMetadata"
      @close="selectedClosure = null"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="cierre de caja"
      :item-name="deleteTarget?.name || deleteTarget?.id"
      :loading="deleting"
      @confirm="deleteClosure"
    />
  </div>
</template>

<script>
import { api } from "boot/axios";
import { Notify } from "quasar";

import {
  apiErrorMessage,
  closureStatusPayload,
  dataFromResponse,
  listAllPages,
  LOAD_ALL_PAGE_SIZE,
  normalizeClosure,
  normalizeClosureDetail,
  paginationParams,
} from "src/services/apiAdapters";

import CashClosuresFilters from "src/components/cash-closures/CashClosuresFilters.vue";
import CashClosuresTable from "src/components/cash-closures/CashClosuresTable.vue";
import ClosureDetailDialog from "src/components/cash-closures/ClosureDetailDialog.vue";
import ModuleToolbar from "components/common/ModuleToolbar.vue";
import ReportMetadataDialog from "src/components/reports/ReportMetadataDialog.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "CashClosures",

  components: {
    CashClosuresFilters,
    CashClosuresTable,
    ClosureDetailDialog,
    ModuleToolbar,
    ReportMetadataDialog,
    DeleteConfirmDialog,
  },

  data() {
    const today = new Date();
    const threeYearsAgo = new Date(today);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 1);

    return {
      closures: [],

      closureDialog: false,

      closureData: null,
      metadataDialog: false,
      metadataSaving: false,
      selectedClosure: null,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,

      totalPayMessenger: null,

      totalPending: null,

      from: threeYearsAgo.toLocaleDateString("sv-SE"),

      to: today.toLocaleDateString("sv-SE"),
    };
  },

  async mounted() {
    await this.filterByDate();
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
    // CARGAR CIERRES
    // =========================================================

    async loadClosures(params = paginationParams()) {
      await listAllPages(api, "/cash-closures", params)
        .then((items) => {
          this.closures = items.map(normalizeClosure);
        })
        .catch((err) => {
          this.notificationMessage(
            apiErrorMessage(err, "No hay data"),
            "negative"
          );
        });
    },

    // =========================================================
    // ABRIR DETALLE DEL CIERRE
    // =========================================================

    async openClosure(id) {
      try {
        const res = await api.get(`/cash-closures/${id}`, {
          params: paginationParams({
            pageSize: LOAD_ALL_PAGE_SIZE,
          }),
        });

        this.closureData = normalizeClosureDetail(
          dataFromResponse(res)
        );

        this.totalPending =
          this.closureData?.closure?.pending_money;

        this.totalPayMessenger =
          this.closureData?.closure?.pending_messenger_pay;

        /*
         * IMPORTANTE:
         * Primero cargamos toda la información del reporte
         * y luego abrimos el dialog.
         */
        this.closureDialog = true;
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "Error al abrir el cierre"),
          "negative"
        );
      }
    },

    // =========================================================
    // CAMBIAR ESTADO
    // =========================================================

    async changeStatus(row) {
      await api
        .put(
          `/cash-closures/${row.id}/status`,
          closureStatusPayload(row.status)
        )
        .then(() => {
          this.notificationMessage(
            "Actualizado",
            "positive"
          );
        })
        .catch((err) => {
          this.notificationMessage(
            apiErrorMessage(
              err,
              "Error al actualizar"
            ),
            "negative"
          );
        });
    },

    // =========================================================
    // EDITAR CIERRE
    // =========================================================

    editClosure(row) {
      this.selectedClosure = row;
      this.metadataDialog = true;
    },

    async saveClosureMetadata(payload) {
      if (!this.selectedClosure?.id || this.metadataSaving) return;

      this.metadataSaving = true;
      try {
        await api.put(`/cash-closures/${this.selectedClosure.id}`, payload);
        this.notificationMessage("Cierre actualizado", "positive");
        this.metadataDialog = false;
        this.selectedClosure = null;
        await this.filterByDate();
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "Error al actualizar"),
          "negative"
        );
      } finally {
        this.metadataSaving = false;
      }
    },

    // =========================================================
    // ELIMINAR CIERRE
    // =========================================================

    openDeleteDialog(row) {
      this.deleteTarget = row;
      this.deleteDialog = true;
    },

    async deleteClosure() {
      if (!this.deleteTarget) return;

      try {
        this.deleting = true;
        await api.delete(`/cash-closures/${this.deleteTarget.id}`);
          this.notificationMessage(
            "Cierre eliminado",
            "positive"
          );

        await this.filterByDate();
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

    // =========================================================
    // FILTRAR POR FECHA
    // =========================================================

    async filterByDate() {
      await listAllPages(api, "/cash-closures", {
        from: this.from,
        to: this.to,
      })
        .then((items) => {
          this.closures = items.map(normalizeClosure);
        })
        .catch((err) => {
          this.notificationMessage(
            apiErrorMessage(
              err,
              "No hay data"
            ),
            "negative"
          );
        });
    },
  },
};
</script>

