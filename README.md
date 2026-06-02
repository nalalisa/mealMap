# Gangdong Meal Map

3D 심초음파 장비(GE Vivid E95 등)의 빔 기하학에 대해 확인하려면 검색이 필요합니다.

DICOM의 3D 심초음파 저장 방식을 확인하는 게 핵심이라 그 부분을 검색합니다.

핵심 답을 정리하면 다음과 같습니다.

## 1. 빔은 등각도로 펼쳐지는가 — 예 (취득 단계에서는)

Vivid E95 같은 매트릭스 어레이 장비는 phased array 원리로 빔을 전자적으로 스티어링합니다. 매트릭스 어레이는 각 크리스털을 독립적으로 활성화·집속·스티어링하여 azimuth(x-y) 및 elevation(x-z) 평면 모두에서 빔을 만들어 피라미드형 3D 스캔 볼륨을 커버 [PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC5100241/) 합니다. 초음파 영상은 한 영역을 가로질러 발산하는 스캔 라인의 연속으로 취득 [DICOM](https://www.dicomstandard.org/News-dir/ftsup/docs/sups/sup43.pdf) 되며, 따라서 취득 raw 도메인에서는 azimuth/elevation 양방향으로 (거의) **등각 간격**의 스캔라인/스캔플레인 구조입니다. 실제로 설계 단계에서 60°×60° 피라미드 볼륨을 X·Z 양방향 모두 1° 빔 간격으로 채우는 [Thoracic Key](https://thoracickey.com/physical-and-technical-aspects-and-overview-of-3d-echocardiography/) 식의 등각도 샘플링을 가정합니다.

## 2. 하지만 DICOM 파일은 보통 이미 Cartesian으로 변환되어 있음

이게 가장 중요한 부분입니다. 취득 기하학과 무관하게, 초기 스캔 영상 취득 후 US 스캐너는 데이터를 적절한 Cartesian 볼륨으로 재조립(reformat) [DICOM](https://www.dicomstandard.org/News-dir/ftsup/docs/sups/sup43.pdf) 합니다. 대부분의 취득 장비는 다른 취득 기하학에서 데이터를 리샘플링하여 Cartesian 볼륨을 구성 [NEMA](https://dicom.nema.org/dicom/2013/output/chtml/part03/sect_A.59.html) 하며, 모든 Cartesian 볼륨은 인접 평면 간 간격이 동일한 평행 평면들의 집합 [NEMA](https://dicom.nema.org/dicom/2013/output/chtml/part03/sect_A.59.html) 입니다.

즉 Enhanced US Volume로 저장된 표준 DICOM은 **이미 등각 → 등간격(직교)으로 스캔 컨버전된 데이터**입니다. 이 경우:

- 별도의 "각도 배열" 태그는 보통 없습니다.
- 복셀 간격(PixelSpacing/SpacingBetweenSlices 또는 Per-frame Functional Group의 spacing)과 FOV·해상도만으로 좌표가 결정됩니다. 즉 **FOV와 해상도(=복셀 간격)만으로 얻으면 되는 값**입니다.

## 3. 단, 각도 정보가 들어있는 경우도 있음

데이터가 원시(곡선/극좌표) 기하학으로 저장된 경우, 볼륨 좌표계를 트랜스듀서 좌표계로 매핑하는 4x4 강체 변환 행렬(Volume to Transducer Mapping Matrix) [Innolitics](https://dicom.innolitics.com/ciods/enhanced-us-volume/ultrasound-frame-of-reference/00209309) 같은 태그가 존재합니다. 또한 구형 Cartesian US(US Multi-frame) 데이터에서는 Sequence of Ultrasound Regions 안의 RegionSpatialFormat / 물리 단위 태그로 sector(부채꼴) 기하학이 기술될 수 있습니다.

## 확인 방법 (실무 권장)

실제 파일에서 다음을 직접 확인하는 게 확실합니다:

1. **SOP Class UID** — Enhanced US Volume이면 직교 볼륨 → FOV+해상도로 충분.
2. 각 프레임의 spacing 태그(`(0028,0030)` PixelSpacing, `(0018,0088)` SpacingBetweenSlices 또는 Per-frame FG의 Pixel Measures)가 일정한지.
3. `Sequence of Ultrasound Regions (0018,6011)` 또는 angle/transducer mapping 관련 태그 존재 여부.

파일 하나를 올려주시면 어떤 형식(직교 변환본인지, 각도 정보 포함 raw인지)인지 태그를 직접 확인해 드릴 수 있습니다.

강동역 인근 회사 식권 사용 가능 식당을 카테고리 기반 treemap으로 탐색하는 정적 웹앱입니다.

사이트는 아침, 점심, 저녁 식당을 토글로 전환해서 볼 수 있고, 식당 클릭 상세보기, 카테고리 드래그 이동, 랜덤 픽 애니메이션, 로컬 DB 수정 기능을 포함합니다.

## Features

- 아침 / 점심 / 저녁 식당 treemap 시각화
- 카테고리별 식당 밀집도 확인
- 식당 클릭 상세보기
- 검색
- 랜덤 선택 애니메이션
- 카테고리 드래그 이동
- 사이드바 드래그 삭제
- 브라우저 `localStorage` 기반 로컬 편집 저장

## Project Structure

- `index.html`
  UI 구조
- `styles.css`
  테마, 레이아웃, 모션, 사이드바 스타일
- `app.js`
  treemap 렌더링, 드래그 앤 드롭, 랜덤 픽, 상세 패널 동작
- `database.js`
  원본 식당 데이터와 보정 정보

## Data Model

`database.js`는 아래 구조를 사용합니다.

- `rawSources`
  아침 / 점심 / 저녁 원본 식당 리스트
- `corrections`
  OCR 오타나 표기 차이를 실제 상호명으로 통합하는 매핑
- `profiles`
  카테고리, 메뉴군, 대표메뉴, 태그 정보

앱 실행 중 수정되는 데이터는 브라우저 `localStorage`에 저장됩니다.

- `profileOverrides`
  기존 식당의 로컬 수정값
- `customRestaurants`
  새로 추가한 식당
- `deletedRestaurants`
  화면에서 삭제 처리한 식당

## Run Locally

정적 파일만으로 동작하므로 아래 중 아무 방식으로든 열면 됩니다.

1. 브라우저에서 `index.html` 직접 열기
2. 간단한 정적 서버 실행

예시:

```powershell
python -m http.server 8000
```

그 후 브라우저에서 `http://localhost:8000` 접속

## GitHub Pages

이 저장소는 GitHub Actions 기반 Pages 배포 워크플로를 포함합니다.

- `master` 브랜치에 푸시하면 자동 배포
- 루트 정적 파일을 그대로 Pages 아티팩트로 업로드

배포가 처음이라면 GitHub 저장소의 `Settings > Pages`에서 source가 `GitHub Actions`로 표시되는지 확인하면 됩니다.

## Notes

- 공식 원본 리스트는 `database.js`의 `rawSources`를 기준으로 유지합니다.
- 삭제는 원본 파일을 직접 지우지 않고 로컬 오버레이(`deletedRestaurants`)로 반영됩니다.
- 카테고리 이동도 원본 DB를 직접 바꾸지 않고 로컬 수정값으로 저장됩니다.

`saturate` + 적절한 스케일링으로 threshold 밖은 자동으로 끝 색(빨강/파랑)에 고정됩니다. threshold를 정규화 기준으로 쓰면 됩니다.

# 픽셀 셰이더 (HLSL)

```hlsl
Texture1D    gGradient : register(t0);
SamplerState gSampler  : register(s0);

cbuffer GradientCB : register(b0)
{
    float planeHeight;   // 기준면 높이
    float posThreshold;  // 양의 threshold (이 이상이면 완전 빨강)
    float negThreshold;  // 음의 threshold (절댓값, 이 이상 아래면 완전 파랑)
    float pad;
};

float4 PS(VSOutput input) : SV_Target
{
    float h = input.worldPos.y - planeHeight; // 기준면 기준 상대 높이

    float u;
    if (h >= 0.0)
        u = 0.5 + 0.5 * saturate(h / posThreshold); // [0, +pos] -> [0.5, 1.0]
    else
        u = 0.5 - 0.5 * saturate(-h / negThreshold); // [-neg, 0] -> [0.0, 0.5]

    // u=0 파랑, u=0.5 노랑(기준면), u=1 빨강
    return gGradient.Sample(gSampler, u);
}
```

# 동작

- `h >= posThreshold` → `saturate`가 1로 고정 → `u=1.0` → 완전 빨강
- `h <= -negThreshold` → `u=0.0` → 완전 파랑
- 기준면(`h=0`) → `u=0.5` → 노랑
- 그 사이만 그라데이션 (위쪽은 노랑→주황→빨강, 아래쪽은 노랑→초록→파랑)

# 핵심 포인트

- 양/음 threshold를 따로 둬서 위아래 매핑 범위를 비대칭으로 조절할 수 있습니다.
- `saturate`가 threshold 밖을 자동으로 끝 색에 고정하므로 별도 분기 없이 처리됩니다.
- 기준면을 `u=0.5`(중앙, 노랑)에 고정해서 "기준면 = 노랑, 위 = 따뜻한 색, 아래 = 차가운 색" 구조가 유지됩니다.
- 텍스처 데이터는 이전 그대로 (파랑→초록→노랑→주황→빨강) 쓰면 됩니다.
# 1D 텍스처 생성

```cpp
// 그라데이션 데이터 (파랑 -> 초록 -> 노랑 -> 주황 -> 빨강, 아래에서 위 순서)
const UINT TEX_WIDTH = 256;
std::vector<uint32_t> pixels(TEX_WIDTH); // RGBA8

auto lerp = [](float a, float b, float t) { return a + (b - a) * t; };

// 키 컬러 (RGB, 0~1)
struct Color { float r, g, b; };
Color keys[] = {
    {0.0f, 0.0f, 1.0f}, // 파랑   (t=0.0)
    {0.0f, 1.0f, 0.0f}, // 초록   (t=0.25)
    {1.0f, 1.0f, 0.0f}, // 노랑   (t=0.5)
    {1.0f, 0.5f, 0.0f}, // 주황   (t=0.75)
    {1.0f, 0.0f, 0.0f}, // 빨강   (t=1.0)
};
const int numKeys = 5;

for (UINT i = 0; i < TEX_WIDTH; ++i) {
    float t = (float)i / (TEX_WIDTH - 1);   // 0~1
    float scaled = t * (numKeys - 1);
    int idx = (int)scaled;
    if (idx >= numKeys - 1) idx = numKeys - 2;
    float f = scaled - idx;

    Color c;
    c.r = lerp(keys[idx].r, keys[idx + 1].r, f);
    c.g = lerp(keys[idx].g, keys[idx + 1].g, f);
    c.b = lerp(keys[idx].b, keys[idx + 1].b, f);

    uint8_t r = (uint8_t)(c.r * 255.0f);
    uint8_t g = (uint8_t)(c.g * 255.0f);
    uint8_t b = (uint8_t)(c.b * 255.0f);
    uint8_t a = 255;
    pixels[i] = (a << 24) | (b << 16) | (g << 8) | r; // RGBA8 (little-endian)
}

// 텍스처 생성
D3D11_TEXTURE1D_DESC desc = {};
desc.Width = TEX_WIDTH;
desc.MipLevels = 1;
desc.ArraySize = 1;
desc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
desc.Usage = D3D11_USAGE_IMMUTABLE;
desc.BindFlags = D3D11_BIND_SHADER_RESOURCE;

D3D11_SUBRESOURCE_DATA initData = {};
initData.pSysMem = pixels.data();
initData.SysMemPitch = TEX_WIDTH * sizeof(uint32_t);

ID3D11Texture1D* pTex = nullptr;
device->CreateTexture1D(&desc, &initData, &pTex);

// SRV 생성
D3D11_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
srvDesc.Format = desc.Format;
srvDesc.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE1D;
srvDesc.Texture1D.MostDetailedMip = 0;
srvDesc.Texture1D.MipLevels = 1;

ID3D11ShaderResourceView* pSRV = nullptr;
device->CreateShaderResourceView(pTex, &srvDesc, &pSRV);
```

# 샘플러

```cpp
D3D11_SAMPLER_DESC sampDesc = {};
sampDesc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR; // 선형 보간으로 부드러운 그라데이션
sampDesc.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;   // 범위 밖은 끝 색으로 고정
sampDesc.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
sampDesc.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
sampDesc.ComparisonFunc = D3D11_COMPARISON_NEVER;
sampDesc.MinLOD = 0;
sampDesc.MaxLOD = D3D11_FLOAT32_MAX;

ID3D11SamplerState* pSampler = nullptr;
device->CreateSamplerState(&sampDesc, &pSampler);
```

# 픽셀 셰이더 (HLSL)

`基準面(planeHeight)` 기준으로 위/아래 높이를 0~1 범위로 정규화해서 U 좌표로 매핑.

```hlsl
Texture1D    gGradient : register(t0);
SamplerState gSampler  : register(s0);

cbuffer GradientCB : register(b0)
{
    float planeHeight; // 기준면 높이
    float range;       // 위아래로 매핑할 반경 (예: 50)
    float2 pad;
};

float4 PS(VSOutput input) : SV_Target
{
    // input.worldPos.y : 픽셀의 월드 높이
    float h = input.worldPos.y - planeHeight;     // 기준면 기준 상대 높이
    float u = saturate(h / (2.0 * range) + 0.5);  // [-range, +range] -> [0,1]

    // u=0(아래) 파랑, u=1(위) 빨강
    return gGradient.Sample(gSampler, u);
}
```

세팅:
```cpp
context->PSSetShaderResources(0, 1, &pSRV);
context->PSSetSamplers(0, 1, &pSampler);
```

# 핵심 포인트

- 1D 텍스처는 가로(U) 한 축만 있으므로 그라데이션을 U 좌표 하나로 매핑합니다.
- `LINEAR` 필터 + `CLAMP` 주소 모드로 부드럽고 범위 안전한 그라데이션이 나옵니다.
- `range`로 그라데이션이 펼쳐질 높이 범위를 조절하고, `saturate`로 범위 밖을 끝 색에 고정합니다.
- 색 순서를 위(빨강)→아래(파랑)로 하려면 텍스처 배열을 그대로 두고 U=1을 위쪽에 매핑하면 됩니다 (위 셰이더가 그 구조).