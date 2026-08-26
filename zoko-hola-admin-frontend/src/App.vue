<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { appTheme } from 'src/config/appTheme';

onMounted(() => {
  document.title = appTheme.name;
  document.querySelectorAll('link[rel="icon"]').forEach((icon) => {
    icon.href = appTheme.favicon;
  });
});
</script>
