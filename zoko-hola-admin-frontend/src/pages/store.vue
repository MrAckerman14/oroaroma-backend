<template>
  <div class="q-pa-md store-page">
    <store-toolbar
      :is-admin="auth.isAdmin"
      v-model:filter="filter"
      :download-all-loading="downloadAllLoading"
      @add-click="dialog = true"
      @report-click="openGeneralReport"
      @download-all-click="openDownloadImagesDialog"
    />

    <store-filters :data="data" @filter="applyProductFilters" />

    <products-grid
      :rows="rows"
      :columns="columns"
      :pagination="productsPagination"
      :rows-per-page-options="rowsPerPageOptions"
      :loading="loadingProducts"
      :filter="filter"
      :is-admin="auth.isAdmin"
      :downloading-product-id="downloadingProductId"
      @request="onProductsRequest"
      @edit="edit"
      @delete="openDeleteDialog"
      @download-image="downloadProductImage"
    />

    <product-add-dialog
      :model-value="dialog || dialogEdit"
      :data="data"
      :is-edit="dialogEdit"
      :loading="savingProduct"
      @update:model-value="setProductDialog"
      @submit="submitProduct"
      @reset="onReset"
    />

    <product-report-dialog
      v-model="dialogGeneralReport"
      :report-products="reportProducts"
      :report-totals="reportTotals"
      :data="data"
      :is-admin="auth.isAdmin"
      @save="saveInventoryReport"
    />

    <DeleteConfirmDialog
      v-model="deleteDialog"
      item-type="producto"
      :item-name="deleteTarget?.name"
      :loading="deleting"
      @confirm="deleteProduct"
    />

    <q-dialog v-model="downloadImagesDialog" persistent>
      <q-card class="download-images-dialog column no-wrap" :class="{ 'download-images-dialog--mobile': $q.screen.lt.sm }">
        <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
          <q-avatar color="yellow-9" text-color="dark" icon="download" />
          <div class="q-ml-md">
            <div class="text-h6 text-weight-bold">Descargar imagenes</div>
            <div class="text-caption text-grey-7">Exporta las imagenes del inventario actual.</div>
          </div>
          <q-space />
          <q-btn icon="close" flat round dense aria-label="Cerrar" :disable="downloadAllLoading" @click="downloadImagesDialog = false" />
        </q-card-section>
        <q-separator />

        <q-card-section class="q-pa-lg bg-grey-1">
          <q-banner rounded class="bg-white text-grey-8 download-images-notice">
            <template #avatar><q-icon name="filter_alt" color="grey-7" /></template>
            Se descargaran solamente las imagenes que coincidan con los filtros aplicados en el almacen.
          </q-banner>

          <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Elige el formato de descarga</div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-card flat bordered class="download-option-card q-pa-md bg-white" :class="{ 'download-option-card--disabled': downloadAllLoading }" role="button" tabindex="0" aria-label="Descargar imagenes en archivo ZIP" @click="downloadAllImagesZip" @keyup.enter="downloadAllImagesZip">
                <q-icon name="folder_zip" size="26px" color="yellow-9" />
                <div class="text-weight-bold q-mt-sm">Archivo ZIP</div>
                <div class="text-caption text-grey-7 q-mt-xs">Descarga todas las imagenes juntas en un solo archivo.</div>
              </q-card>
            </div>
            <div class="col-12 col-sm-6">
              <q-card flat bordered class="download-option-card q-pa-md bg-white" :class="{ 'download-option-card--disabled': downloadAllLoading }" role="button" tabindex="0" aria-label="Descargar imagenes una por una" @click="downloadAllImagesIndividually" @keyup.enter="downloadAllImagesIndividually">
                <q-icon name="collections" size="26px" color="grey-8" />
                <div class="text-weight-bold q-mt-sm">Una por una</div>
                <div class="text-caption text-grey-7 q-mt-xs">Inicia una descarga independiente por cada imagen.</div>
              </q-card>
            </div>
          </div>
        </q-card-section>

      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { Notify } from "quasar";
import { api } from "src/boot/axios";
import { useAuthStore } from "src/stores/auth";
import {
  dataFromResponse,
  apiErrorMessage,
  listAllPages,
  listFromResponse,
  LOAD_ALL_PAGE_SIZE,
  normalizeInventoryPreview,
  normalizeProduct,
  paginationParams,
  storeFormData,
  storePayload,
} from "src/services/apiAdapters";

import StoreToolbar from "components/store/StoreToolbar.vue";
import StoreFilters from "components/store/StoreFilters.vue";
import ProductsGrid from "components/store/ProductsGrid.vue";
import ProductAddDialog from "components/store/ProductAddDialog.vue";
import ProductReportDialog from "components/store/ProductReportDialog.vue";
import DeleteConfirmDialog from "components/common/DeleteConfirmDialog.vue";

export default {
  name: "ProductManager",

  components: {
    StoreToolbar,
    StoreFilters,
    ProductsGrid,
    ProductAddDialog,
    ProductReportDialog,
    DeleteConfirmDialog,
  },

  data() {
    const todayStr = new Date().toLocaleDateString("sv-SE");
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const tomorrowStr = date.toLocaleDateString("sv-SE");

    return {
      accept: false,
      dialog: false,
      reportProducts: [],
      reportTotals: { total_products: 0, total_inventory_value: 0 },
      dialogGeneralReport: false,
      dialogEdit: false,
      deleteDialog: false,
      deleteTarget: null,
      deleting: false,
      savingProduct: false,
      rows: [],
      loadingProducts: false,
      downloadAllLoading: false,
      downloadImagesDialog: false,
      downloadMode: "",
      downloadingProductId: null,
      imageDownloadQueue: [],
      imageDownloadResumeIndex: 0,
      imageDownloadFilterKey: "",
      filter: "",
      productsPagination: {
        page: 1,
        rowsPerPage: 100,
        rowsNumber: 0,
      },
      rowsPerPageOptions: [5, 10, 25, 50, 100, 250, 500, 0],

      data: {
        id: null,
        name: "",
        purchase_price: "",
        sale_price: "",
        stock: 0,
        file: null,
        from: todayStr,
        to: tomorrowStr,
        image_path: "",
        minStock: "",
        maxStock: "",
        soldFrom: "",
        soldTo: "",
        reportName: "",
        reportNote: "",
      },

      baseColumns: [
        {
          name: "name",
          required: true,
          label: "Nombre",
          align: "left",
          field: (row) => row.name,
          sortable: true,
        },
        {
          name: "purchase_price",
          label: "Precio de compra",
          field: "purchase_price",
          align: "left",
        },
        {
          name: "sale_price",
          label: "Precio de venta",
          field: "sale_price",
          sortable: true,
          align: "left",
        },
        {
          name: "stock",
          label: "Stock",
          field: "stock",
          sortable: true,
          align: "left",
        },
        {
          name: "quantity_sold",
          label: "Vendidos",
          field: "quantity_sold",
          sortable: true,
          align: "left",
        },
        { name: "image", label: "Imagen", field: "image_path", align: "left" },
      ],
    };
  },

  computed: {
    auth() {
      return useAuthStore();
    },

    columns() {
      if (!this.auth.isAdmin) return this.baseColumns;

      return [
        ...this.baseColumns,
        {
          name: "",
          label: "Opciones",
          field: "",
          sortable: false,
          align: "left",
        },
      ];
    },
  },

  mounted() {
    this.getProducts();
  },

  watch: {
    filter() {
      this.productsPagination.page = 1;
      this.getProducts();
    },
  },

  methods: {
    notificationMessage(message, type) {
      Notify.create({
        type: type,
        message: message,
      });
    },

    setProductDialog(value) {
      if (!value) this.onReset();
    },

    async submitProduct() {
      if (this.savingProduct) return;

      if (this.dialogEdit) {
        await this.editProduct();
        return;
      }

      await this.onSubmit();
    },

    async onProductsRequest(props) {
      const pagination = props?.pagination || this.productsPagination;
      this.productsPagination = {
        ...this.productsPagination,
        page: pagination.page,
        rowsPerPage: pagination.rowsPerPage,
      };

      await this.getProducts();
    },

    applyProductFilters() {
      this.productsPagination.page = 1;
      this.getProducts();
    },

    productListParams() {
      const pageSize = this.productsPagination.rowsPerPage === 0
        ? Math.max(this.productsPagination.rowsNumber, 100)
        : this.productsPagination.rowsPerPage || 100;

      return {
        page: this.productsPagination.page,
        pageSize,
        ...this.productFilterParams(),
      };
    },

    productFilterParams() {
      return {
        ...(this.filter ? { search: this.filter } : {}),
        ...(this.data.soldFrom ? { from: this.data.soldFrom } : {}),
        ...(this.data.soldTo ? { to: this.data.soldTo } : {}),
        ...(this.data.minStock !== "" ? { minStock: this.data.minStock } : {}),
        ...(this.data.maxStock !== "" ? { maxStock: this.data.maxStock } : {}),
      };
    },

    async getProducts() {
      this.loadingProducts = true;
      try {
        const response = await api.get("/stores", {
          params: this.productListParams(),
        });
        const payload = dataFromResponse(response);
        const products = Array.isArray(payload?.items) ? payload.items : listFromResponse(response);
        this.rows = products.map(normalizeProduct);
        this.productsPagination = {
          ...this.productsPagination,
          rowsNumber: Number(payload?.pagination?.total || products.length),
        };
        this.clearImageDownloadProgress();
      } catch (err) {
        console.error("Error al obtener producto:", err);
        this.notificationMessage(
          apiErrorMessage(err, "No se pudieron cargar los productos"),
          "negative"
        );
      } finally {
        this.loadingProducts = false;
      }
    },

    edit(row) {
      if (!this.auth.isAdmin) return;

      this.data.name = row.name;
      this.data.sale_price = row.sale_price;
      this.data.stock = row.stock;
      this.data.file = null;
      this.data.purchase_price = row.purchase_price;
      this.dialogEdit = true;
      this.data.id = row.id;
      this.data.image_path = row.image_path;
    },

    async openGeneralReport() {
      if (!this.auth.isAdmin) return;

      try {
        const response = await api.get("/inventory/reports/preview", {
          params: paginationParams({ pageSize: LOAD_ALL_PAGE_SIZE }),
        });
        const preview = normalizeInventoryPreview(dataFromResponse(response));
        this.reportProducts = preview.products;
        this.reportTotals = preview.totals;
        this.dialogGeneralReport = true;
      } catch (err) {
        console.error("Error al obtener preview del reporte:", err);
      }
    },

    saveInventoryReport() {
      if (!this.auth.isAdmin) return;

      api
        .post("/inventory/reports", {
          ...(this.data.reportName ? { name: this.data.reportName } : {}),
          ...(this.data.reportNote ? { note: this.data.reportNote } : {}),
        })
        .then((response) => {
          this.notificationMessage("Reporte Creado!", "positive");
          this.dialogGeneralReport = false;
        })
        .catch((err) => {
          this.notificationMessage(
            apiErrorMessage(err, "Error al crear reporte"),
            "negative"
          );
        });
    },

    async onSubmit() {
      if (!this.auth.isAdmin) return;
      if (this.savingProduct) return;

      if (this.accept !== true) {
        try {
          this.savingProduct = true;
          const res = await api.post("/stores", storeFormData(this.data));
          this.notificationMessage("Producto agregado!", "positive");
          await this.getProducts();
          this.onReset();
        } catch (err) {
          console.error("Error al agregar producto:", err);
          this.notificationMessage(
            apiErrorMessage(err, "Error al agregar"),
            "negative"
          );
        } finally {
          this.savingProduct = false;
        }
      }
    },

    onReset() {
      this.accept = false;
      this.dialog = false;
      this.data.name = "";
      this.data.purchase_price = "";
      this.data.sale_price = "";
      this.data.stock = 0;
      this.data.file = null;
      this.data.image_path = "";
      this.data.id = null;
      this.dialogEdit = false;
    },

    openDeleteDialog(value) {
      this.deleteTarget = value;
      this.deleteDialog = true;
    },

    async deleteProduct() {
      if (!this.auth.isAdmin) return;
      if (!this.deleteTarget) return;

      try {
        this.deleting = true;
        await api.delete(`/stores/${this.deleteTarget.id}`);
        this.notificationMessage("Producto eliminado", "positive");
        await this.getProducts();
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

    async editProduct() {
      if (!this.auth.isAdmin) return;
      if (this.savingProduct) return;

      const id = this.data.id;

      try {
        this.savingProduct = true;
        await api.put(`/stores/${id}`, storePayload(this.data));

        if (this.data.file instanceof File) {
          const imageData = new FormData();
          imageData.append("image", this.data.file);
          await api.post(`/stores/${id}/image`, imageData);
        }

        this.notificationMessage("Producto actualizado", "positive");
        this.onReset();
        await this.getProducts();
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "Error al actualizar"),
          "negative"
        );
      } finally {
        this.savingProduct = false;
      }
    },

    safeFilename(name, fallback = "producto") {
      return String(name || fallback)
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/\s+/g, " ")
        || fallback;
    },

    async downloadBlob(url, filename, successMessage = "Descarga completada", notify = true) {
      try {
        const response = await api.get(url, { responseType: "blob" });
        const objectUrl = URL.createObjectURL(response.data);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        if (notify) this.notificationMessage(successMessage, "positive");
        return true;
      } catch (err) {
        if (notify) this.notificationMessage(apiErrorMessage(err, "No se pudo descargar"), "negative");
        return false;
      }
    },

    async downloadProductImage(row) {
      if (!row?.id || this.downloadingProductId) return;

      this.downloadingProductId = row.id;
      await this.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        await this.downloadBlob(
          `/stores/${row.id}/image/download`,
          `${this.safeFilename(row.name)}.jpg`,
          "Imagen descargada"
        );
      } finally {
        this.downloadingProductId = null;
      }
    },

    openDownloadImagesDialog() {
      if (this.downloadAllLoading) return;
      this.downloadImagesDialog = true;
    },

    async downloadAllImagesZip() {
      if (this.downloadAllLoading) return;

      this.downloadAllLoading = true;
      this.downloadMode = "zip";
      await this.$nextTick();
      try {
        const response = await api.get("/stores/images/download", {
          params: this.productFilterParams(),
          responseType: "blob",
        });
        const objectUrl = URL.createObjectURL(response.data);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "imagenes-almacen.zip";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        this.downloadImagesDialog = false;
        this.notificationMessage("Descarga ZIP iniciada", "positive");
      } catch (err) {
        this.notificationMessage(
          apiErrorMessage(err, "No se pudo descargar el ZIP"),
          "negative"
        );
      } finally {
        this.downloadAllLoading = false;
        this.downloadMode = "";
      }
    },

    async downloadAllImagesIndividually() {
      if (this.downloadAllLoading) return;

      this.downloadAllLoading = true;
      this.downloadMode = "individual";
      await this.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        const filterKey = this.currentImageDownloadFilterKey();
        const shouldResume =
          this.imageDownloadQueue.length &&
          this.imageDownloadFilterKey === filterKey;

        await this.downloadImageQueue(shouldResume ? this.imageDownloadResumeIndex : 0, filterKey);
      } finally {
        this.downloadAllLoading = false;
        this.downloadMode = "";
      }
    },

    currentImageDownloadFilterKey() {
      return JSON.stringify(this.productFilterParams());
    },

    async imageDownloadQueueFromAllPages() {
      const products = await listAllPages(api, "/stores", {
        ...this.productFilterParams(),
        pageSize: 500,
      });

      return products
        .map(normalizeProduct)
        .filter((product) => product.id && product.image_path)
        .map((product) => ({
          id: product.id,
          name: product.name,
        }));
    },

    async downloadImageQueue(startIndex = 0, filterKey = this.currentImageDownloadFilterKey()) {
      const canResume =
        this.imageDownloadQueue.length &&
        this.imageDownloadFilterKey === filterKey;

      const queue = canResume
        ? this.imageDownloadQueue
        : await this.imageDownloadQueueFromAllPages();

      if (!queue.length) {
        this.clearImageDownloadProgress();
        this.notificationMessage("No hay imagenes para descargar", "warning");
        return;
      }

      this.imageDownloadQueue = queue;
      this.imageDownloadFilterKey = filterKey;
      this.imageDownloadResumeIndex = Math.max(0, Math.min(startIndex, queue.length - 1));

      for (let index = this.imageDownloadResumeIndex; index < queue.length; index += 1) {
        const product = queue[index];
        const success = await this.downloadBlob(
          `/stores/${product.id}/image/download`,
          `${this.safeFilename(product.name)}.jpg`,
          "Imagen descargada",
          false
        );

        if (!success) {
          this.imageDownloadResumeIndex = index;
          this.notifyImageDownloadStopped(product, index, queue.length);
          return;
        }

        this.imageDownloadResumeIndex = index + 1;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const total = queue.length;
      this.clearImageDownloadProgress();
      this.notificationMessage(`Imagenes descargadas: ${total}`, "positive");
    },

    async resumeImageDownloads() {
      if (this.downloadAllLoading || !this.imageDownloadQueue.length) return;

      this.downloadAllLoading = true;
      await this.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        await this.downloadImageQueue(this.imageDownloadResumeIndex, this.imageDownloadFilterKey);
      } finally {
        this.downloadAllLoading = false;
      }
    },

    clearImageDownloadProgress() {
      this.imageDownloadQueue = [];
      this.imageDownloadResumeIndex = 0;
      this.imageDownloadFilterKey = "";
    },

    notifyImageDownloadStopped(product, index, total) {
      Notify.create({
        type: "warning",
        message: `Descarga detenida en ${index + 1} de ${total}: ${product?.name || "producto"}`,
        timeout: 0,
        actions: [
          {
            label: "Reanudar",
            color: "white",
            handler: () => {
              this.resumeImageDownloads();
            },
          },
        ],
      });
    },
  },
};
</script>

<style scoped>
.download-images-dialog { width: min(600px, 94vw); max-width: 600px; border-radius: 18px; }
.download-images-dialog--mobile { height: auto; max-height: calc(100vh - 32px); border-radius: 18px; }
.download-images-notice { border: 1px solid #e8e8e8; }
.download-option-card { min-height: 150px; border-radius: 14px; cursor: pointer; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
.download-option-card:hover { border-color: var(--app-primary); box-shadow: 0 8px 18px rgba(0, 0, 0, .08); transform: translateY(-2px); }
.download-option-card--disabled { cursor: default; opacity: .6; pointer-events: none; }
</style>
