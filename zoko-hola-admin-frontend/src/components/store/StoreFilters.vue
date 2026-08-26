<template>
  <q-card flat bordered class="store-filters q-my-md">
    <q-card-section class="q-pa-md cursor-pointer" @click="expanded = !expanded">
      <div class="row items-center no-wrap">
        <q-icon name="tune" size="20px" class="q-mr-sm" />
        <div>
          <div class="text-subtitle1 text-weight-bold">Filtros</div>
          <div class="text-caption text-grey-7">
            Acota el inventario por ventas o nivel de existencias.
          </div>
        </div>
        <q-space />
        <q-btn
          round
          flat
          color="black"
          :icon="expanded ? 'expand_less' : 'expand_more'"
          :aria-label="expanded ? 'Ocultar filtros' : 'Mostrar filtros'"
          @click.stop="expanded = !expanded"
        />
      </div>
    </q-card-section>

    <q-slide-transition>
      <div v-show="expanded">
        <q-separator />
        <q-card-section class="q-pa-md">
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-sm-6 col-md-4">
          <DateRangeFilter
            :from="data.soldFrom"
            :to="data.soldTo"
            @update:from="data.soldFrom = $event"
            @update:to="data.soldTo = $event"
            @filter="$emit('filter')"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-input
            v-model="data.minStock"
            type="number"
            label="Stock mínimo"
            outlined
            dense
            color="black"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-input
            v-model="data.maxStock"
            type="number"
            label="Stock máximo"
            outlined
            dense
            color="black"
          />
        </div>
        <div class="col-12 col-md-2">
          <q-btn
            class="full-width"
            color="yellow-9"
            text-color="black"
            icon="search"
            label="Aplicar filtros"
            @click="$emit('filter')"
          />
        </div>
      </div>
        </q-card-section>
      </div>
    </q-slide-transition>
  </q-card>
</template>

<script>
import DateRangeFilter from "components/common/DateRangeFilter.vue";

export default {
  name: "StoreFilters",
  components: { DateRangeFilter },
  props: {
    data: { type: Object, required: true },
  },
  emits: ["filter"],
  data() {
    return {
      expanded: false,
    };
  },
};
</script>

<style scoped>
.store-filters {
  border-radius: 16px;
  border-color: #e7e7e7;
  background: #fffdf7;
}
</style>
