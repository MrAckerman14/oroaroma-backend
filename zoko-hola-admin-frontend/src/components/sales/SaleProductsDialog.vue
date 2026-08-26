<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="sale-products-dialog column no-wrap" :class="{ 'sale-products-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="inventory_2" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Seleccionar perfumes</div>
          <div class="text-caption text-grey-7">
            Agrega productos y ajusta las cantidades de la venta.
          </div>
        </div>
        <q-space /><q-btn
          icon="close"
          flat
          round
          dense
          aria-label="Cerrar"
          v-close-popup
        />
      </q-card-section>
      <q-separator />

      <q-card-section
        class="col scroll bg-grey-1"
        :class="$q.screen.lt.sm ? 'q-pa-md' : 'q-pa-lg'"
      >
        <div class="row q-col-gutter-lg">
          <div class="col-12 col-md-8">
            <q-card
              flat
              bordered
              class="sale-products-panel q-pa-md bg-white"
            >
              <div class="row items-center wrap q-mb-md">
                <div>
                  <div class="text-subtitle1 text-weight-bold">
                    Catálogo disponible
                  </div>
                  <div class="text-caption text-grey-7">
                    Selecciona un perfume para añadirlo a la venta.
                  </div>
                </div>
                <q-space /><q-input
                  v-model="filter"
                  dense
                  outlined
                  clearable
                  debounce="200"
                  placeholder="Buscar perfume"
                  class="sale-catalog-search"
                >
                  <template #prepend><q-icon name="search" /></template>
                </q-input>
              </div>
              <div class="row q-col-gutter-md">
                <div
                  v-for="product in filteredProducts"
                  :key="product.id"
                  class="col-6 col-sm-4 col-md-3"
                >
                  <q-card
                    clickable
                    flat
                    bordered
                    class="sale-product-card relative-position bg-white"
                    :class="{ 'sale-product-card--selected': getQuantity(product.id) > 0 }"
                    @click="$emit('add-product', product)"
                  >
                    <q-img
                      v-if="product.image_path"
                      :src="assetUrl(product.image_path, api.defaults.baseURL)"
                      ratio="1"
                    />
                    <q-img v-else src="/no-image.png" ratio="1" />
                    <q-badge
                      v-if="getQuantity(product.id) > 0"
                      color="yellow-9"
                      text-color="black"
                      floating
                      class="sale-product-quantity q-pa-sm text-weight-bold flex flex-center"
                      >{{ getQuantity(product.id) }}</q-badge
                    >
                    <q-card-section class="q-pa-sm text-center"
                      ><div class="text-subtitle2 text-weight-bold ellipsis">
                        {{ product.name }}
                      </div>
                      <q-badge
                        class="q-mt-sm q-py-sm q-px-md"
                        rounded
                        :color="product.stock === 0 ? 'red-2' : 'grey-3'"
                        :text-color="product.stock === 0 ? 'negative' : 'dark'"
                        :label="`Stock: ${product.stock}`"
                    /></q-card-section>
                  </q-card>
                </div>
              </div>
            </q-card>
          </div>

          <div class="col-12 col-md-4">
            <q-card flat bordered class="sale-products-panel bg-white">
              <q-card-section class="q-pb-sm"
                ><div class="text-subtitle1 text-weight-bold">
                  Selección actual
                </div>
                <div class="text-caption text-grey-7">
                  {{ formData.detail.length }} productos, {{ totalSelectedQuantity }} unidades
                </div></q-card-section
              >
              <q-separator />
              <q-card-section
                class="sale-selection-list q-pa-none scroll"
              >
                <div
                  v-if="!formData.detail.length"
                  class="q-pa-xl text-center text-grey-7"
                >
                  <q-icon name="add_shopping_cart" size="40px" />
                  <div class="text-weight-medium q-mt-sm">
                    No has seleccionado perfumes.
                  </div>
                  <div class="text-caption q-mt-xs">
                    Elige un producto del catálogo para comenzar.
                  </div>
                </div>
                <q-list v-else separator
                  ><q-item
                    v-for="item in formData.detail"
                    :key="item.product_id"
                    class="q-py-md"
                    ><q-item-section avatar
                      ><q-avatar size="48px" rounded
                        ><img
                          :src="assetUrl(item.image_path, api.defaults.baseURL)"
                          class="sale-selected-image" /></q-avatar></q-item-section
                    ><q-item-section
                      ><q-item-label class="text-weight-bold">{{
                        item.name
                      }}</q-item-label
                      ><q-item-label caption
                        >Unidades seleccionadas</q-item-label
                      ></q-item-section
                    ><q-item-section side
                      ><div class="quantity-stepper row items-center no-wrap">
                        <q-btn
                          icon="remove"
                          color="negative"
                          flat
                          dense
                          size="sm"
                          aria-label="Reducir cantidad"
                          @click="removeAmountProduct(item.product_id)"
                        /><q-input
                          v-model="item.quantity"
                          class="quantity-stepper__input"
                          type="number"
                          borderless
                          dense
                        />
                        <q-btn
                          icon="add"
                          color="blue"
                          flat
                          dense
                          size="sm"
                          aria-label="Aumentar cantidad"
                          @click="addAmountProduct(item.product_id)"
                        /></div></q-item-section></q-item
                ></q-list>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-px-lg q-py-md bg-white"
        ><q-btn
          label="Listo"
          color="yellow-9"
          text-color="black"
          icon="check"
          v-close-popup
      /></q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { api } from "src/boot/axios";
import { assetUrl } from "src/services/apiAdapters";
export default {
  name: "SaleProductsDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    products: { type: Array, default: () => [] },
    formData: { type: Object, required: true },
  },
  emits: ["update:modelValue", "add-product"],
  data() {
    return { api, filter: "" };
  },
  computed: {
    filteredProducts() {
      const term = String(this.filter || "").trim().toLowerCase();
      if (!term) return this.products;
      return this.products.filter((product) =>
        String(product?.name || "").toLowerCase().includes(term)
      );
    },
    totalSelectedQuantity() {
      return this.formData.detail.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      );
    },
  },
  methods: {
    assetUrl,
    getQuantity(productId) {
      const item = this.formData.detail.find((p) => p.product_id === productId);
      return item ? item.quantity : 0;
    },
    addAmountProduct(productId) {
      const index = this.formData.detail.findIndex(
        (p) => p.product_id === productId
      );
      if (index !== -1) this.formData.detail[index].quantity++;
    },
    removeAmountProduct(productId) {
      const index = this.formData.detail.findIndex(
        (p) => p.product_id === productId
      );
      if (index !== -1) {
        if (this.formData.detail[index].quantity > 1)
          this.formData.detail[index].quantity--;
        else this.formData.detail.splice(index, 1);
      }
    },
  },
};
</script>

<style scoped>
.sale-products-dialog {
  width: min(1120px, 96vw);
  height: min(820px, calc(100vh - 32px));
  max-width: 1120px;
  border-radius: 18px;
}

.sale-products-dialog--mobile {
  border-radius: 0;
}

.sale-products-panel {
  border-radius: 18px;
}

.sale-catalog-search {
  width: 210px;
}

.sale-product-card {
  border-radius: 14px;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.sale-product-card:hover {
  transform: translateY(-3px);
  border-color: var(--app-primary-border);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
}

.sale-product-card--selected {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 1px var(--app-primary);
}

.sale-product-quantity {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0 !important;
  border-radius: 50% !important;
}

.sale-selection-list {
  max-height: 500px;
}

.sale-selected-image {
  object-fit: cover;
}

.quantity-stepper {
  min-height: 36px;
  overflow: hidden;
  border: 1px solid #d9dce1;
  border-radius: 10px;
  background: #fff;
}

.quantity-stepper__input {
  width: 42px;
  border-right: 1px solid #edf0f2;
  border-left: 1px solid #edf0f2;
}

.quantity-stepper__input :deep(.q-field__control) {
  min-height: 34px;
  height: 34px;
}

.quantity-stepper__input :deep(input) {
  width: 100%;
  padding: 0;
  text-align: center;
  font-weight: 700;
  appearance: textfield;
  -moz-appearance: textfield;
}

.quantity-stepper__input :deep(input::-webkit-inner-spin-button),
.quantity-stepper__input :deep(input::-webkit-outer-spin-button) {
  margin: 0;
  -webkit-appearance: none;
}

@media (max-width: 599px) {
  .sale-catalog-search {
    width: 100%;
    margin-top: 12px;
  }

  .sale-selection-list {
    max-height: none;
  }
}
</style>
