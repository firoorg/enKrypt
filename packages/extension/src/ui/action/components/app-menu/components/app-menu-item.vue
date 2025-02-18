<template>
  <a class="app-menu__link" :class="{ active: isActive }">
    <img ref="imageTag" :src="network.icon" alt="" />
    <span>{{ network.name_long }} </span
    ><test-network-icon v-if="network.isTestNetwork" />
    <span
      v-if="newNetworks.includes(network.name)"
      class="tag tag-new tag-sm shimmer"
      >New</span
    >
    <span
      v-if="newSwaps.includes(network.name)"
      class="tag tag-swap tag-sm shimmer"
      >Swap</span
    >
    <div class="app-menu__link-drag">
      <drag-icon />
    </div>
  </a>
</template>

<script setup lang="ts">
import { NodeType } from '@/types/provider';
import { PropType, ref, watch } from 'vue';
import DragIcon from '@action/icons/common/drag-icon.vue';
import TestNetworkIcon from '@action/icons/common/test-network-icon.vue';
import { newNetworks, newSwaps } from '@/providers/common/libs/new-features';

const props = defineProps({
  network: {
    type: Object as PropType<NodeType>,
    default: () => {
      return {};
    },
  },
  isActive: {
    type: Boolean,
    default: () => {
      return false;
    },
  },
});
const imageTag = ref<HTMLImageElement | null>(null);
const emit = defineEmits<{
  (e: 'update:gradient', data: string): void;
}>();
const componentToHex = (c: number) => {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
};
const getAverageRGB = (imgEl: HTMLImageElement) => {
  const blockSize = 5, // only visit every 5 pixels
    defaultRGB = { r: 0, g: 0, b: 0 }, // for non-supporting envs
    canvas = document.createElement('canvas'),
    context = canvas.getContext && canvas.getContext('2d'),
    rgb = { r: 0, g: 0, b: 0 };
  let data: ImageData;
  let count = 0;
  let i = -4;

  if (!context) {
    return defaultRGB;
  }
  const height = (canvas.height =
    imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height);
  const width = (canvas.width =
    imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width);
  context.drawImage(imgEl, 0, 0);
  try {
    data = context.getImageData(0, 0, width, height);
  } catch (e) {
    return defaultRGB;
  }
  const length = data.data.length;
  while ((i += blockSize * 4) < length) {
    ++count;
    rgb.r += data.data[i];
    rgb.g += data.data[i + 1];
    rgb.b += data.data[i + 2];
  }
  // ~~ used to floor values
  rgb.r = ~~(rgb.r / count);
  rgb.g = ~~(rgb.g / count);
  rgb.b = ~~(rgb.b / count);
  emit(
    'update:gradient',
    `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`,
  );
};
watch(
  () => props.isActive,
  () => {
    if (props.isActive) getAverageRGB(imageTag.value!);
  },
);
</script>

<style lang="less">
@import '@action/styles/theme.less';
.tag {
  display: inline-block;
  padding: 0.2em 0.5em 0.3em;
  border-radius: 8px;
  margin: 0.25em 0.1em;
  margin-left: 0.5em;
}
.tag-sm {
  display: inline-block;
  letter-spacing: 0.15ch;
  font-weight: 400;
}
.tag-swap {
  background: #41b883;
  color: #35495e !important;
}
.tag-new {
  background: #a481d5;
  color: #fff !important;
}
.shimmer {
  color: grey;
  display: inline-block;
  -webkit-mask: linear-gradient(-60deg, #000 30%, #0005, #000 70%) right/300%
    100%;
  background-repeat: no-repeat;
  animation: shimmer 2.5s infinite;
  font-size: 50px;
  max-width: 200px;
}

@keyframes shimmer {
  100% {
    -webkit-mask-position: left;
  }
}
.app-menu {
  &__link {
    text-decoration: none;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    flex-direction: row;
    width: 100%;
    height: 40px;
    margin-bottom: 4px;
    cursor: pointer;
    position: relative;

    &:hover {
      background: @black004;
      border-radius: 10px;

      .app-menu__link-drag {
        display: block !important;
      }
    }

    img {
      width: 24px;
      height: 24px;
      margin: 0 8px;
      border-radius: 50%;
    }

    span {
      font-style: normal;
      font-weight: normal;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0.25px;
      color: @primaryLabel;
    }

    &.active {
      background: @black007;
      border-radius: 10px;

      span {
        font-weight: 500;
      }
    }

    &-drag {
      position: absolute;
      right: 8px;
      padding: 4px;
      top: 50%;
      margin-top: -12px;
      cursor: grab;
      display: none;
    }
  }
}
</style>
