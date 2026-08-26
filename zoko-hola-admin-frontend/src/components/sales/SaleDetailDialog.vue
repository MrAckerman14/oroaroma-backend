<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card
      class="sale-detail-dialog column no-wrap"
      :class="{ 'sale-detail-dialog--mobile': $q.screen.lt.sm }"
    >
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="receipt_long" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Detalle de venta</div>
          <div class="text-caption text-grey-7">
            {{ totalQuantity }} unidad{{ totalQuantity === 1 ? '' : 'es' }} en esta venta
          </div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="$emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">
        <div class="row items-center q-mb-md">
          <div>
            <div class="text-subtitle1 text-weight-bold">Perfumes seleccionados</div>
            <div class="text-caption text-grey-7">Cantidad, precio unitario y total por producto.</div>
          </div>
          <q-space />
          <q-badge color="yellow-9" text-color="dark" class="q-px-sm q-py-xs text-weight-bold">
            {{ detailItems.length }} productos, {{ totalQuantity }} unidades
          </q-badge>
        </div>

        <div v-if="detailItems.length" class="q-gutter-md">
          <q-card v-for="item in detailItems" :key="item.key" flat bordered class="sale-detail-item bg-white">
            <q-card-section class="row no-wrap q-pa-md">
              <q-avatar rounded size="76px" class="bg-grey-2">
                <q-img
                  v-if="item.imagePath"
                  :src="imageUrl(item.imagePath)"
                  fit="cover"
                  class="sale-detail-image"
                />
                <q-icon v-else name="inventory_2" color="grey-6" size="30px" />
              </q-avatar>
              <div class="col q-ml-md">
                <div class="text-subtitle1 text-weight-bold ellipsis">{{ item.name }}</div>
                <div class="text-caption text-grey-7 q-mt-xs">Precio unitario: {{ moneyFormat(item.price) }}</div>
                <q-badge outline color="grey-8" class="q-mt-sm">Cantidad: {{ item.quantity }}</q-badge>
              </div>
              <div class="column justify-between items-end q-ml-sm">
                <div class="text-caption text-grey-7">Total</div>
                <div class="text-subtitle1 text-weight-bold">{{ moneyFormat(item.subtotal) }}</div>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="sale-detail-item bg-yellow-1">
            <q-card-section class="row items-center q-pa-md">
              <q-avatar color="yellow-9" text-color="dark" icon="payments" />
              <div class="q-ml-md">
                <div class="text-subtitle2 text-weight-bold">Total de productos</div>
                <div class="text-caption text-grey-8">Suma de todos los perfumes seleccionados.</div>
              </div>
              <q-space />
              <div class="text-right q-ml-md">
                <div class="text-caption text-grey-8">Total acumulado</div>
                <div class="text-h6 text-weight-bold">{{ moneyFormat(totalProductsAmount) }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <q-card v-else flat bordered class="sale-detail-item bg-white">
          <q-card-section class="text-center text-grey-7 q-pa-xl">
            No hay productos registrados en esta venta.
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-separator />
      <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
        <q-btn unelevated color="yellow-9" text-color="dark" icon="close" label="Cerrar" @click="$emit('update:modelValue', false)" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { api } from "src/boot/axios";
import { assetUrl } from "src/services/apiAdapters";

export default {
  name: "SaleDetailDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    sale: { type: Object, default: null },
    products: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue"],
  computed: {
    detailItems() {
      return (this.sale?.details || this.sale?.detail || []).map((detail, index) => {
        const product = this.products.find((item) => item.id === detail.store_id || item.id === detail.product_id);
        const quantity = Number(detail.count ?? detail.quantity ?? 0);
        const price = Number(detail.price ?? product?.price ?? 0);

        return {
          key: detail.id || `${detail.store_id || detail.product_id || 'product'}-${index}`,
          name: detail.name || product?.name || "Perfume",
          imagePath: detail.image_path || product?.image_path,
          quantity,
          price,
          subtotal: quantity * price,
        };
      });
    },
    totalQuantity() {
      return this.detailItems.reduce((total, item) => total + item.quantity, 0);
    },
    totalProductsAmount() {
      return this.detailItems.reduce((total, item) => total + item.subtotal, 0);
    },
  },
  methods: {
    imageUrl(path) {
      return assetUrl(path, api.defaults.baseURL);
    },
    moneyFormat(value) {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(value || 0));
    },
  },
};
</script>

<style scoped>
.sale-detail-dialog {
  width: min(760px, 94vw);
  height: min(680px, calc(100vh - 32px));
  border-radius: 18px;
}

.sale-detail-dialog--mobile {
  border-radius: 0;
}

.sale-detail-item {
  border-radius: 14px;
}

.sale-detail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
