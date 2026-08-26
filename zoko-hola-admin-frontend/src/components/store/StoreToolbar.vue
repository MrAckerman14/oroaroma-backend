<template>
  <q-card flat bordered class="store-toolbar">
    <q-card-section class="q-pa-md">
      <div class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="row items-center no-wrap">
            <div class="store-toolbar__icon">
              <q-icon name="inventory_2" size="26px" />
            </div>
            <div class="q-ml-md">
              <div class="store-toolbar__title text-h6 text-weight-bold">Almacén</div>
              <div class="store-toolbar__subtitle text-caption text-grey-7">
                Gestiona productos, existencias e imágenes.
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-auto toolbar-search-wrap">
          <q-input
            class="toolbar-search"
            outlined
            dense
            debounce="300"
            color="black"
            :model-value="filter"
            @update:model-value="$emit('update:filter', $event)"
            placeholder="Buscar producto"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>

        </div>

        <div class="col-auto store-toolbar__buttons">
          <q-btn
            v-if="isAdmin"
            :round="!$q.screen.gt.xs"
            icon="add"
            color="yellow-9"
            text-color="black"
            :label="$q.screen.gt.xs ? 'Agregar' : undefined"
            class="toolbar-action-button"
            @click="$emit('add-click')"
          >
            <q-tooltip>Agregar producto</q-tooltip>
          </q-btn>

          <q-btn
            v-if="isAdmin"
            round
            outline
            color="black"
            icon="assessment"
            @click="$emit('report-click')"
          >
            <q-tooltip>Crear reporte de inventario</q-tooltip>
          </q-btn>

          <q-btn
            round
            outline
            color="black"
            icon="download"
            :loading="downloadAllLoading"
            :disable="downloadAllLoading"
            @click="$emit('download-all-click')"
          >
            <q-tooltip>Descargar todas las imágenes</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
export default {
  name: "StoreToolbar",
  props: {
    isAdmin: { type: Boolean, default: false },
    filter: { type: String, default: "" },
    downloadAllLoading: { type: Boolean, default: false },
  },
  emits: ["add-click", "report-click", "download-all-click", "update:filter"],
};
</script>

<style scoped>
.store-toolbar {
  border-radius: 16px;
  border-color: #e7e7e7;
}

.store-toolbar__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: #000;
  background: var(--app-primary);
}

.store-toolbar__buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.toolbar-search-wrap {
  display: flex;
}

.toolbar-search {
  width: 240px;
}

.toolbar-action-button {
  min-height: 40px;
}

.toolbar-action-button :deep(.q-btn__content) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.toolbar-action-button :deep(.q-btn__content .q-icon) {
  margin: 0 8px 0 0 !important;
}

@media (max-width: 599px) {
  .store-toolbar__icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .store-toolbar__icon :deep(.q-icon) {
    font-size: 22px !important;
  }

  .store-toolbar__title {
    font-size: 18px;
    line-height: 1.1;
  }

  .store-toolbar__subtitle {
    display: none;
  }

  .store-toolbar__buttons {
    gap: 6px;
  }

  .toolbar-action-button {
      padding: 9px;
  }

  .toolbar-action-button :deep(.q-btn__content .q-icon) {
    margin: 0 !important;
  }

  .toolbar-search-wrap {
    order: 3;
    width: 100%;
  }

  .toolbar-search {
    width: 100%;
  }
}
</style>
