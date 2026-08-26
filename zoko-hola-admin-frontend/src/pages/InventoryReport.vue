<template>
  <div class="q-pa-md">

    <!-- ========================= -->
    <!-- FILTROS -->
    <!-- ========================= -->

    <ModuleToolbar
      title="Reportes de Inventario"
      subtitle="Consulta reportes y el valor del inventario."
      icon="assessment"
      class="q-mb-md"
    >
      <template #filter>
      <InventoryReportsFilters
        :from="data.from"
        :to="data.to"
        @update:from="data.from = $event"
        @update:to="data.to = $event"
        @filter="filterByDate"
      />
      </template>
    </ModuleToolbar>

    <!-- ========================= -->
    <!-- TABLA PRINCIPAL -->
    <!-- ========================= -->

    <InventoryReportsTable
      :rows="rows"
      @open="openDetail"
      @edit="editReport"
      @delete="openDeleteDialog"
    />

    <!-- ========================= -->
    <!-- DETALLE DEL REPORTE -->
    <!-- ========================= -->

    <InventoryReportDetailDialog
      v-model="dialog"
      :selected-report="selectedReport"
    />

    <ReportMetadataDialog
      v-model="metadataDialog"
      title="Editar reporte de inventario"
      :report="selectedMetadataReport"
      :loading="metadataSaving"
      @submit="saveReportMetadata"
      @close="selectedMetadataReport = null"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="reporte de inventario"
      :item-name="deleteTarget?.name || deleteTarget?.id"
      :loading="deleting"
      @confirm="deleteReport"
    />
  </div>
</template>

<script>
import { api } from "boot/axios";
import { Notify } from "quasar";

import {
  apiErrorMessage,
  dataFromResponse,
  listAllPages,
  LOAD_ALL_PAGE_SIZE,
  normalizeInventoryReport,
  normalizeInventoryReportDetail,
  paginationParams,
} from "src/services/apiAdapters";

import InventoryReportsFilters from "src/components/inventory-reports/InventoryReportsFilters.vue";
import InventoryReportsTable from "src/components/inventory-reports/InventoryReportsTable.vue";
import InventoryReportDetailDialog from "src/components/inventory-reports/InventoryReportDetailDialog.vue";
import ModuleToolbar from "components/common/ModuleToolbar.vue";
import ReportMetadataDialog from "src/components/reports/ReportMetadataDialog.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "InventoryReports",

  components: {
    InventoryReportsFilters,
    InventoryReportsTable,
    InventoryReportDetailDialog,
    ModuleToolbar,
    ReportMetadataDialog,
    DeleteConfirmDialog,
  },

  data() {
    return {
      rows: [],

      dialog: false,

      selectedReport: null,
      selectedMetadataReport: null,
      metadataDialog: false,
      metadataSaving: false,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,

      reportTotals: {
        total_products: 0,
        total_inventory_value: 0,
      },

      data: {
        from: "",
        to: "",
      },
    };
  },

  mounted() {
    this.loadReports();
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
    // CARGAR REPORTES
    // =========================================================

    async load() {
      try {
        const reports = await listAllPages(
          api,
          "/inventory/reports",
          paginationParams({ pageSize: LOAD_ALL_PAGE_SIZE })
        );

        this.rows = reports.map(
          normalizeInventoryReport
        );

        this.reportTotals = this.rows.reduce(
          (acc, r) => {
            acc.total_products +=
              r.total_products;

            acc.total_inventory_value +=
              Number(
                r.total_inventory_value
              );

            return acc;
          },
          {
            total_products: 0,
            total_inventory_value: 0,
          }
        );
      } catch (err) {
        console.error(err);

        console.warn(
          apiErrorMessage(
            err,
            "No se pudieron cargar los reportes"
          )
        );

        this.rows = [];

        this.reportTotals = {
          total_products: 0,
          total_inventory_value: 0,
        };
      }
    },

    // =========================================================
    // CARGAR REPORTES POR FECHA
    // =========================================================

    async loadReports() {
      try {
        const dateRange = this.data.from && this.data.to
          ? { from: this.data.from, to: this.data.to }
          : this.allRecordsDateRange();

        const reports = await listAllPages(
          api,
          "/inventory/reports",
          dateRange
        );

        this.rows = reports.map(
          normalizeInventoryReport
        );

        this.reportTotals = this.rows.reduce(
          (acc, r) => {
            acc.total_products +=
              r.total_products;

            acc.total_inventory_value +=
              Number(
                r.total_inventory_value
              );

            return acc;
          },
          {
            total_products: 0,
            total_inventory_value: 0,
          }
        );
      } catch (err) {
        console.error(err);

        console.warn(
          apiErrorMessage(
            err,
            "No se pudieron cargar los reportes"
          )
        );

        this.rows = [];

        this.reportTotals = {
          total_products: 0,
          total_inventory_value: 0,
        };
      }
    },

    // =========================================================
    // ABRIR DETALLE
    // =========================================================

    async openDetail(report) {
      try {
        const response = await api.get(
          `/inventory/reports/${report.id}`,
          {
            params: paginationParams({
              pageSize: LOAD_ALL_PAGE_SIZE,
            }),
          }
        );

        this.selectedReport =
          normalizeInventoryReportDetail(
            dataFromResponse(response)
          );

        /*
         * Primero cargamos el detalle.
         * Después abrimos el dialog.
         */
        this.dialog = true;
      } catch (err) {
        console.error(err);

        console.warn(
          apiErrorMessage(
            err,
            "No se pudo abrir el detalle"
          )
        );
      }
    },

    // =========================================================
    // EDITAR REPORTE
    // =========================================================

    editReport(report) {
      this.selectedMetadataReport = report;
      this.metadataDialog = true;
    },

    async saveReportMetadata(payload) {
      if (!this.selectedMetadataReport?.id || this.metadataSaving) return;

      this.metadataSaving = true;
      try {
        await api.put(
          `/inventory/reports/${this.selectedMetadataReport.id}`,
          payload
        );

        this.notificationMessage(
          "Reporte actualizado",
          "positive"
        );

        this.metadataDialog = false;
        this.selectedMetadataReport = null;
        await this.loadReports();
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(
            err,
            "No se pudo actualizar el reporte"
          ),
          "negative"
        );
      } finally {
        this.metadataSaving = false;
      }
    },

    // =========================================================
    // ELIMINAR REPORTE
    // =========================================================

    openDeleteDialog(report) {
      this.deleteTarget = report;
      this.deleteDialog = true;
    },

    async deleteReport() {
      if (!this.deleteTarget) return;

      try {
        this.deleting = true;
        await api.delete(
          `/inventory/reports/${this.deleteTarget.id}`
        );

        this.notificationMessage(
          "Reporte eliminado",
          "positive"
        );

        await this.loadReports();
        this.deleteDialog = false;
        this.deleteTarget = null;
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(
            err,
            "No se pudo eliminar el reporte"
          ),
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
      await this.loadReports();
    },

    allRecordsDateRange() {
      return {
        from: "2000-01-01",
        to: new Date().toLocaleDateString("sv-SE"),
      };
    },
  },
};
</script>
