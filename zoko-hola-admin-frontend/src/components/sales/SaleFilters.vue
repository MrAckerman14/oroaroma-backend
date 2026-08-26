<template>
  <div class="module-filter-actions">
      <DateRangeFilter
        :from="filters.from"
        :to="filters.to"
        @update:from="filters.from = $event"
        @update:to="filters.to = $event"
        @filter="$emit('filter')"
      />
  </div>
</template>

<script>
import DateRangeFilter from "components/common/DateRangeFilter.vue";

export default {
  name: "SaleFilters",
  components: { DateRangeFilter },
  props: {
    filters: { type: Object, required: true },
  },
  emits: ["filter"],
};
</script>
