<template>
  <q-card flat bordered class="module-toolbar">
    <q-card-section class="module-toolbar__content q-pa-md">
      <div class="row items-center q-col-gutter-x-md q-col-gutter-y-sm">
        <div class="col">
          <div class="row items-center no-wrap">
            <div class="module-toolbar__icon">
              <q-icon :name="icon" size="26px" />
            </div>
            <div class="q-ml-md">
              <div class="module-toolbar__title text-h6 text-weight-bold">{{ title }}</div>
              <div class="module-toolbar__subtitle text-caption text-grey-7">{{ subtitle }}</div>
            </div>
          </div>
        </div>

        <div v-if="$slots.buttons" class="col-auto module-toolbar__buttons">
          <slot name="buttons" />
        </div>

        <div v-if="$slots.filter" class="col-12 col-md-auto module-toolbar__filter">
          <slot name="filter" />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
export default {
  name: "ModuleToolbar",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    icon: { type: String, default: "dashboard" },
  },
};
</script>

<style scoped>
.module-toolbar {
  border-radius: 16px;
  border-color: #e7e7e7;
}

.module-toolbar__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: var(--app-surface);
  background: var(--app-primary);
}

.module-toolbar__buttons,
.module-toolbar__filter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.module-toolbar__buttons {
  gap: 8px;
  white-space: nowrap;
}

.module-toolbar__buttons :deep(.toolbar-action-button) {
  min-height: 40px;
}

.module-toolbar__buttons :deep(.toolbar-action-button .q-btn__content) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.module-toolbar__buttons :deep(.toolbar-action-button .q-btn__content .q-icon) {
  margin: 0 8px 0 0 !important;
}

.module-toolbar__filter :deep(.date-range-filter .q-field__control) {
  min-height: 40px;
}

@media (max-width: 599px) {
  .module-toolbar__content {
    padding: 10px 12px;
  }

  .module-toolbar__icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .module-toolbar__icon :deep(.q-icon) {
    font-size: 22px !important;
  }

  .module-toolbar__title {
    font-size: 18px;
    line-height: 1.1;
  }

  .module-toolbar__subtitle {
    display: none;
  }

  .module-toolbar__buttons {
    gap: 6px;
  }

  .module-toolbar__filter {
    width: 100%;
    justify-content: flex-start;
  }

  .module-toolbar__filter :deep(.date-range-filter) {
    width: 100%;
    min-width: 0;
  }

  .module-toolbar__filter :deep(.module-filter-actions) {
    width: 100%;
  }
}
</style>
