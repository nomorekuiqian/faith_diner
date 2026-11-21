'use client'

import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, type ReactNode, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sfx } from './fx/sound'

interface Props {
  receipt: HTMLCanvasElement
  reduced: boolean
  onPrinted: () => void
  onFail: () => void
}

class WebGLBoundary extends Component<{ onFail: () => void; children: ReactNode }, { broken: boolean }> {
  state = { broken: false }
  static getDerivedStateFromError() {
    return { broken: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.broken ? null : this.props.children
  }
}

// 模块级缓存静态程序化贴图，避免每次打开小票重复绘制卡顿主线程
let cachedWood: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null = null
let cachedMatte: THREE.CanvasTexture | null = null
let cachedBadge: THREE.CanvasTexture | null = null

function getWoodTextures() {
  if (cachedWood) return cachedWood
  const w = 512
  const h = 512
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = w
  colorCanvas.height = h
  const ctx = colorCanvas.getContext('2d')!
  ctx.fillStyle = '#d9bc94'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 180; i++) {
    const y = (i / 180) * h
    const alpha = 0.03 + ((i * 37) % 10) * 0.008
    ctx.strokeStyle = i % 3 === 0 ? `rgba(116, 76, 38, ${alpha})` : `rgba(246, 228, 198, ${alpha * 0.8})`
    ctx.lineWidth = 1 + ((i * 13) % 3)
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= w; x += 64) {
      ctx.lineTo(x, y + Math.sin(x * 0.012 + i * 0.25) * 2.5)
    }
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(98, 64, 32, 0.16)'
  ctx.lineWidth = 2
  for (const sy of [128, 256, 384]) {
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(w, sy)
    ctx.stroke()
  }
  const map = new THREE.CanvasTexture(colorCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(2.2, 2.2)

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = 256
  roughCanvas.height = 256
  const rctx = roughCanvas.getContext('2d')!
  rctx.fillStyle = '#a8a8a8'
  rctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 90; i++) {
    rctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    rctx.fillRect(0, (i / 90) * 256, 256, 2)
  }
  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
  roughnessMap.repeat.set(2.2, 2.2)

  cachedWood = { map, roughnessMap }
  return cachedWood
}

function getMatteBump() {
  if (cachedMatte) return cachedMatte
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + ((i * 2654435761) >>> 28)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 5)
  cachedMatte = tex
  return tex
}

function getBadgeTexture() {
  if (cachedBadge) return cachedBadge
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 512, 128)
  ctx.fillStyle = '#c94a29'
  ctx.beginPath()
  ctx.roundRect(10, 24, 32, 32, 7)
  ctx.fill()
  ctx.fillStyle = '#fff9f0'
  ctx.font = '700 20px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('食', 26, 40)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#362920'
  ctx.font = '400 42px "ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif'
  ctx.fillText('美股信仰食堂', 52, 43)
  ctx.fillStyle = '#8b7762'
  ctx.font = '600 17px "IBM Plex Mono", monospace'
  ctx.fillText('NO.80  WARM THERMAL', 53, 90)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  cachedBadge = tex
  return tex
}

const SLOT_Y = 1.24
const SLOT_Z = 0.36
const CAM_TARGET_VEC = new THREE.Vector3()

function DinerCounterScene({ receipt, reduced, onPrinted }: Omit<Props, 'onFail'>) {
  const { gl } = useThree()
  const paperGroupRef = useRef<THREE.Group>(null)
  const ledMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const printerRef = useRef<THREE.Group>(null)
  const bellRef = useRef<THREE.Group>(null)

  const wood = useMemo(() => getWoodTextures(), [])
  const matteBump = useMemo(() => getMatteBump(), [])
  const badgeTex = useMemo(() => getBadgeTexture(), [])

  const paperData = useMemo(() => {
    const tex = new THREE.CanvasTexture(receipt)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy())

    const pw = 1.66
    const ph = (pw * receipt.height) / receipt.width
    const seg = 48
    const geo = new THREE.PlaneGeometry(pw, ph, 1, seg)
    geo.translate(0, ph / 2, 0)
    const baseY = Float32Array.from(
      { length: geo.attributes.position.count },
      (_, i) => (geo.attributes.position as THREE.BufferAttribute).getY(i)
    )
    const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(SLOT_Y + 0.03))
    return { tex, pw, ph, geo, baseY, clip }
  }, [receipt, gl])

  useEffect(() => {
    gl.localClippingEnabled = true
    return () => {
      paperData.tex.dispose()
      paperData.geo.dispose()
    }
  }, [gl, paperData])

  const stateRef = useRef({
    progress: reduced ? 1 : 0,
    startedAt: -1,
    finished: false,
    cutPlayed: false,
    bellBounce: 0,
    dirtyPaper: true,
    stopPrinter: null as (() => void) | null
  })

  useEffect(() => {
    return () => {
      stateRef.current.stopPrinter?.()
      stateRef.current.stopPrinter = null
    }
  }, [])

  const teeth = useMemo(() => Array.from({ length: 18 }, (_, i) => -0.92 + (i / 17) * 1.84), [])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const s = stateRef.current
    const elapsed = state.clock.elapsedTime
    const duration = Math.max(1.2, Math.min(2.6, paperData.ph * 0.42))

    if (!reduced) {
      if (s.startedAt < 0) s.startedAt = elapsed + 0.15
      if (elapsed >= s.startedAt && s.progress < 1) {
        if (!s.stopPrinter) s.stopPrinter = sfx.printer()
        s.progress = Math.min(1, (elapsed - s.startedAt) / duration)
        s.dirtyPaper = true
        if (printerRef.current) {
          printerRef.current.position.x = Math.sin(elapsed * 55) * 0.0022
        }
      } else if (printerRef.current) {
        printerRef.current.position.x = 0
      }

      if (s.progress >= 1 && !s.cutPlayed) {
        s.cutPlayed = true
        s.stopPrinter?.()
        s.stopPrinter = null
        s.bellBounce = 1
        sfx.ding()
      }
    }

    if (s.progress >= 1 && !s.finished) {
      s.finished = true
      onPrinted()
    }

    const shown = s.progress * paperData.ph
    if (s.dirtyPaper) {
      s.dirtyPaper = false
      if (paperGroupRef.current) {
        paperGroupRef.current.position.y = SLOT_Y + 0.03 - (paperData.ph - shown)
      }
      const pos = paperData.geo.attributes.position as THREE.BufferAttribute
      const norm = paperData.geo.attributes.normal as THREE.BufferAttribute
      const { baseY, ph } = paperData
      const curlStart = 0.72
      const R = 1.95
      const maxAngle = Math.PI * 0.72
      for (let i = 0; i < pos.count; i++) {
        const above = baseY[i] - (ph - shown)
        if (above <= curlStart) {
          pos.setY(i, baseY[i])
          pos.setZ(i, 0)
          norm.setXYZ(i, 0, 0, 1)
        } else {
          const d = above - curlStart
          const a = Math.min(d / R, maxAngle)
          const extra = Math.max(0, d - R * maxAngle)
          const yy = curlStart + R * Math.sin(a) + extra * Math.cos(a)
          const zz = -R * (1 - Math.cos(a)) - extra * Math.sin(a)
          pos.setY(i, ph - shown + yy)
          pos.setZ(i, zz)
          norm.setXYZ(i, 0, Math.sin(a), Math.cos(a))
        }
      }
      pos.needsUpdate = true
      norm.needsUpdate = true
    }

    if (ledMatRef.current) {
      if (s.progress < 1) {
        ledMatRef.current.color.set('#e58b2e')
        ledMatRef.current.emissive.set('#e58b2e')
        ledMatRef.current.emissiveIntensity = 1.2 + Math.sin(elapsed * 14) * 0.6
      } else {
        ledMatRef.current.color.set('#449e6a')
        ledMatRef.current.emissive.set('#449e6a')
        ledMatRef.current.emissiveIntensity = 1.2
      }
    }

    if (bellRef.current && s.bellBounce > 0) {
      s.bellBounce = Math.max(0, s.bellBounce - dt * 2.4)
      bellRef.current.position.y = 0.02 + Math.sin(s.bellBounce * Math.PI * 3) * 0.024 * s.bellBounce
    }

    if (s.progress < 1) {
      const midY = Math.min(2.7, 1.05 + shown * 0.28)
      const dist = Math.max(5.5, 4.7 + shown * 0.6)
      CAM_TARGET_VEC.set(dist * 0.3, midY + dist * 0.34, dist * 0.92)
      state.camera.position.lerp(CAM_TARGET_VEC, 0.08)
    }
  })

  return (
    <>
      {/* 静态烘焙 1 帧影棚环境反射，零每帧重算开销 */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.6} color="#fff2d6" position={[-6, 4, 4]} rotation={[0, Math.PI / 3, 0]} scale={[8, 6, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#fffaf0" position={[0, 7, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#f6dec0" position={[6, 2, 3]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 4, 1]} />
        <Lightformer form="ring" intensity={0.9} color="#ffe4b5" position={[0, 3, -6]} scale={5} />
      </Environment>

      <ambientLight intensity={0.44} color="#fff7ea" />
      <directionalLight
        position={[-4.5, 8.5, 5.5]}
        intensity={2.0}
        color="#ffefd4"
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={8}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[5, 3, -3]} intensity={0.7} color="#ffe0ba" />

      {/* 食堂原木柜台台面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial map={wood.map} roughnessMap={wood.roughnessMap} roughness={0.62} metalness={0.02} />
      </mesh>

      {/* 静态烘焙 1 帧桌面接触软阴影（frames={1} 是 60fps 丝滑关键） */}
      <ContactShadows frames={1} resolution={256} position={[0, 0.005, 0]} opacity={0.4} scale={10} blur={2.2} far={4} color="#4e3218" />

      <group ref={printerRef} position={[0, 0.02, 0]}>
        <RoundedBox args={[2.56, 0.16, 2.24]} radius={0.07} smoothness={4} position={[0, 0.1, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#5c4028" roughness={0.68} metalness={0.05} />
        </RoundedBox>

        {[-0.98, 0.98].map((x) =>
          [-0.84, 0.84].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.02, z]}>
              <cylinderGeometry args={[0.11, 0.13, 0.04, 16]} />
              <meshStandardMaterial color="#2f241c" roughness={0.9} />
            </mesh>
          ))
        )}

        <RoundedBox args={[2.48, 1.06, 2.16]} radius={0.22} smoothness={5} position={[0, 0.68, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#f6efe2" roughness={0.42} metalness={0.04} bumpMap={matteBump} bumpScale={0.003} />
        </RoundedBox>

        <RoundedBox args={[2.3, 0.18, 1.24]} radius={0.08} smoothness={4} position={[0, 1.22, -0.38]} castShadow receiveShadow>
          <meshStandardMaterial color="#ebe0cd" roughness={0.46} metalness={0.03} bumpMap={matteBump} bumpScale={0.003} />
        </RoundedBox>

        <RoundedBox args={[2.06, 0.08, 0.24]} radius={0.03} smoothness={3} position={[0, SLOT_Y - 0.02, SLOT_Z]} receiveShadow>
          <meshStandardMaterial color="#dfd2bc" roughness={0.55} />
        </RoundedBox>

        <mesh position={[0, SLOT_Y, SLOT_Z]}>
          <boxGeometry args={[1.92, 0.05, 0.11]} />
          <meshStandardMaterial color="#241b14" roughness={0.95} />
        </mesh>

        <RoundedBox args={[1.98, 0.045, 0.065]} radius={0.015} smoothness={3} position={[0, SLOT_Y + 0.015, SLOT_Z + 0.095]}>
          <meshStandardMaterial color="#d4ab5a" metalness={0.88} roughness={0.26} />
        </RoundedBox>
        {teeth.map((tx, idx) => (
          <mesh key={idx} position={[tx, SLOT_Y + 0.038, SLOT_Z + 0.085]} rotation={[0.2, 0, 0]}>
            <coneGeometry args={[0.024, 0.032, 3]} />
            <meshStandardMaterial color="#d9b468" metalness={0.9} roughness={0.24} />
          </mesh>
        ))}

        <RoundedBox args={[2.16, 0.032, 0.028]} radius={0.01} smoothness={2} position={[0, 0.94, 1.08]}>
          <meshStandardMaterial color="#cfa24f" metalness={0.88} roughness={0.28} />
        </RoundedBox>

        <mesh position={[-0.32, 0.56, 1.084]}>
          <planeGeometry args={[1.42, 0.355]} />
          <meshBasicMaterial map={badgeTex} transparent />
        </mesh>

        <mesh position={[0.62, 0.56, 1.075]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.135, 0.145, 0.05, 24]} />
          <meshStandardMaterial color="#cfa24f" metalness={0.86} roughness={0.28} />
        </mesh>
        <mesh position={[0.62, 0.56, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.105, 0.11, 0.06, 24]} />
          <meshStandardMaterial color="#c94a29" roughness={0.32} metalness={0.08} />
        </mesh>

        <mesh position={[0.92, 0.56, 1.085]}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <meshStandardMaterial ref={ledMatRef} color="#449e6a" emissive="#449e6a" emissiveIntensity={1.2} roughness={0.2} />
        </mesh>

        <group ref={paperGroupRef} position={[0, SLOT_Y + 0.03 - paperData.ph, SLOT_Z]} rotation={[-0.1, 0, 0]}>
          <mesh geometry={paperData.geo} castShadow>
            <meshStandardMaterial
              map={paperData.tex}
              roughness={0.92}
              metalness={0}
              side={THREE.FrontSide}
              clippingPlanes={[paperData.clip]}
              alphaTest={0.5}
            />
          </mesh>
          <mesh geometry={paperData.geo}>
            <meshStandardMaterial color="#efe7d8" roughness={0.95} metalness={0} side={THREE.BackSide} clippingPlanes={[paperData.clip]} />
          </mesh>
        </group>
      </group>

      {/* 手作抹茶陶瓷热茶杯 */}
      <group position={[-2.15, 0.02, 0.55]}>
        <mesh position={[0, 0.34, 0]} castShadow>
          <cylinderGeometry args={[0.31, 0.25, 0.68, 24]} />
          <meshStandardMaterial color="#efe5d5" roughness={0.52} metalness={0.02} bumpMap={matteBump} bumpScale={0.004} />
        </mesh>
        <mesh position={[0, 0.64, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.275, 24]} />
          <meshStandardMaterial color="#587d57" roughness={0.18} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.255, 0.24, 0.1, 20]} />
          <meshStandardMaterial color="#b48a62" roughness={0.85} />
        </mesh>
      </group>

      {/* 复古黄铜出餐按铃 */}
      <group ref={bellRef} position={[2.02, 0.02, 0.65]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.36, 0.39, 0.08, 24]} />
          <meshStandardMaterial color="#3b2b20" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.08, 0]} castShadow>
          <sphereGeometry args={[0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d8ae5e" metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.43, 0]}>
          <cylinderGeometry args={[0.075, 0.06, 0.08, 16]} />
          <meshStandardMaterial color="#e2be76" metalness={0.94} roughness={0.15} />
        </mesh>
      </group>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.6}
        maxDistance={10.5}
        minPolarAngle={0.28}
        maxPolarAngle={Math.PI / 2 - 0.08}
        target={[0, 1.35, 0]}
      />
    </>
  )
}

export default function PrinterStage({ receipt, reduced, onPrinted, onFail }: Props) {
  return (
    <div className="printer-stage" aria-label="美股信仰食堂 3D 收银出票机，可以拖动旋转查看小票">
      <WebGLBoundary onFail={onFail}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [1.9, 3.0, 5.4], fov: 30, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              onFail()
            })
          }}
        >
          <DinerCounterScene receipt={receipt} reduced={reduced} onPrinted={onPrinted} />
        </Canvas>
      </WebGLBoundary>
    </div>
  )
}
