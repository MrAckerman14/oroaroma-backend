<template>
  <div class="module-filter-actions">
    <DateRangeFilter
      :from="filters.from"
      :to="filters.to"
      @range-selected="updateFilters"
      @filter="$emit('filter')"
    />
  </div>
</template>

<script>
import DateRangeFilter from "components/common/DateRangeFilter.vue";

export default {
  name: "MessengerFilters",
  components: { DateRangeFilter },
  props: {
    filters: {
      type: Object,
      required: true,
    },
  },
  emits: ["filter", "update:filters"],
  methods: {
    updateFilters(range) {
      this.$emit("update:filters", {
        ...this.filters,
        from: range.from,
        to: range.to,
      });
    },
  },
};
</script>
