<template>
  <q-table
    class="products-grid"
    flat
    :rows="rows"
    :columns="columns"
    row-key="name"
    binary-state-sort
    :pagination="pagination"
    :rows-per-page-options="rowsPerPageOptions"
    :loading="loading"
    :filter="filter"
    grid
    hide-header
    @request="$emit('request', $event)"
    @update:pagination="$emit('update:pagination', $event)"
  >
    <template #item="props">
      <div class="col-12 col-md-4 product-grid-item q-pa-sm">
        <q-card flat bordered class="product-card fit column no-wrap">
          <q-img
            :src="productImage(props.row)"
            :ratio="4 / 3"
            class="product-card__image"
            spinner-color="yellow-9"
          >
            <div class="absolute-top row items-center justify-between product-card__image-bar">
              <q-badge
                class="stock-status"
                rounded
                :color="stockColor(props.row.stock)"
                :class="{ 'stock-status--low': Number(props.row.stock || 0) > 0 && Number(props.row.stock || 0) <= 24 }"
                :label="stockLabel(props.row.stock)"
              />

              <q-btn round dense flat color="white" icon="more_vert">
                <q-menu anchor="bottom right" self="top right">
                  <q-list dense style="min-width: 190px">
                    <q-item v-if="isAdmin" v-close-popup clickable @click="$emit('edit', props.row)">
                      <q-item-section avatar><q-icon name="edit" color="yellow-9" /></q-item-section>
                      <q-item-section>Editar producto</q-item-section>
                    </q-item>
                    <q-item v-if="isAdmin" v-close-popup clickable @click="$emit('delete', props.row)">
                      <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
                      <q-item-section>Eliminar producto</q-item-section>
                    </q-item>
                    <q-separator v-if="isAdmin && props.row.image_path" />
                    <q-item
                      v-if="props.row.image_path"
                      v-close-popup
                      clickable
                      :disable="downloadingProductId === props.row.id"
                      @click="$emit('download-image', props.row)"
                    >
                      <q-item-section avatar>
                        <q-spinner v-if="downloadingProductId === props.row.id" color="yellow-9" size="20px" />
                        <q-icon v-else name="download" />
                      </q-item-section>
                      <q-item-section>Descargar imagen</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-img>

          <q-card-section class="q-pa-md product-card__body">
            <div class="text-subtitle1 text-weight-bold ellipsis" :title="props.row?.name">
              {{ props.row?.name || "Producto sin nombre" }}
            </div>

            <div class="row items-end justify-between q-mt-sm">
              <div>
                <div class="text-caption text-grey-7">Precio de venta</div>
                <div class="text-h6 text-weight-bold">{{ money(props.row.sale_price) }}</div>
              </div>
              <div class="sales-highlight text-right">
                <div class="text-caption">Vendidos</div>
                <div class="text-subtitle1 text-weight-bold">
                  {{ Number(props.row.quantity_sold || 0).toLocaleString() }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-sm" />

            <div class="inventory-highlight row items-center justify-between">
              <span>Existencia</span>
              <span>{{ Number(props.row.stock || 0).toLocaleString() }} unidades</span>
            </div>
            <div v-if="isAdmin" class="row items-center justify-between text-caption q-mt-xs">
              <span class="text-grey-7">Costo unitario</span>
              <span>{{ money(props.row.purchase_price) }}</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </template>

    <template #no-data>
      <div class="full-width row flex-center q-pa-xl text-grey-7">
        <div class="text-center">
          <q-icon name="inventory_2" size="48px" />
          <div class="text-subtitle1 text-weight-medium q-mt-sm">
            No encontramos productos con estos filtros.
          </div>
        </div>
      </div>
    </template>
  </q-table>
</template>

<script>
import { api } from "src/boot/axios";
import { assetUrl } from "src/services/apiAdapters";
import imageNotFound from "src/assets/image-not-found.png";

export default {
  name: "ProductsGrid",
  props: {
    rows: { type: Array, required: true },
    columns: { type: Array, required: true },
    pagination: { type: Object, required: true },
    rowsPerPageOptions: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    filter: { type: String, default: "" },
    isAdmin: { type: Boolean, default: false },
    downloadingProductId: { type: [Number, String, null], default: null },
  },
  emits: ["request", "update:pagination", "edit", "delete", "download-image"],
  methods: {
    productImage(row) {
      return row?.image_path
        ? assetUrl(row.image_path, api.defaults.baseURL)
        : imageNotFound;
    },

    stockColor(stock) {
      const value = Number(stock || 0);
      if (value > 24) return "positive";
      if (value > 0) return "warning";
      return "negative";
    },

    stockLabel(stock) {
      const value = Number(stock || 0);
      if (value > 24) return "Stock disponible";
      if (value > 0) return "Stock bajo";
      return "Sin stock";
    },

    money(value) {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(value || 0));
    },
  },
};
</script>

<style scoped>
.products-grid :deep(.q-table__middle) {
  overflow: visible;
}

.products-grid :deep(.q-table__grid-content) {
  margin: -8px;
}

.product-card {
  min-height: 100%;
  border-radius: 16px;
  border-color: #e7e7e7;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.1);
}

.product-card__image {
  background: #f4f4f4;
}

.product-card__image-bar {
  padding: 10px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.48), transparent);
}

.stock-status {
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.stock-status--low {
  color: #000 !important;
  background: #f9a825 !important;
}

.sales-highlight {
  min-width: 74px;
  padding: 6px 10px;
  color: #000;
  border-radius: 10px;
  background: #fff4c7;
}

.sales-highlight .text-caption {
  color: #6a5000;
  font-weight: 700;
}

.inventory-highlight {
  padding: 9px 10px;
  color: #1d1d1d;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid var(--app-primary-border);
  border-radius: 10px;
  background: var(--app-primary-soft);
}

.product-card__body {
  flex: 1;
}

@media (min-width: 1200px) {
  .product-grid-item {
    flex: 0 0 20%;
    width: 20%;
  }
}
</style>
