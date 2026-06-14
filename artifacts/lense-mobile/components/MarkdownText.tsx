import React from "react";
import { Text, View, TextStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  text: string;
  baseSize?: number;
  muted?: boolean;
}

type Seg = { bold: boolean; italic: boolean; text: string };

function parseInline(raw: string): Seg[] {
  const segs: Seg[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segs.push({ bold: false, italic: false, text: raw.slice(last, m.index) });
    if (m[0]!.startsWith("**")) segs.push({ bold: true,  italic: false, text: m[2]! });
    else                         segs.push({ bold: false, italic: true,  text: m[3]! });
    last = m.index + m[0]!.length;
  }
  if (last < raw.length) segs.push({ bold: false, italic: false, text: raw.slice(last) });
  return segs;
}

function InlineSegs({ segs, color, fontSize }: { segs: Seg[]; color: string; fontSize: number }) {
  return (
    <>
      {segs.map((s, i) => (
        <Text
          key={i}
          style={{
            fontFamily: s.bold ? "Inter_700Bold" : "Inter_400Regular",
            fontStyle: s.italic ? "italic" : "normal",
            color,
            fontSize,
          }}
        >
          {s.text}
        </Text>
      ))}
    </>
  );
}

export function MarkdownText({ text, baseSize = 14, muted = false }: Props) {
  const colors = useColors();
  const color = muted ? colors.mutedForeground : colors.foreground;
  const lh = Math.round(baseSize * 1.55);

  const base: TextStyle = {
    fontSize: baseSize,
    lineHeight: lh,
    fontFamily: "Inter_400Regular",
    color,
  };

  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");

  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();

    if (trimmed === "") {
      nodes.push(<View key={idx} style={{ height: 5 }} />);
      return;
    }

    // Headers
    if (/^###\s/.test(trimmed)) {
      nodes.push(
        <Text key={idx} style={[base, { fontFamily: "Inter_700Bold", fontSize: baseSize + 1, marginTop: 10, marginBottom: 2 }]}>
          {trimmed.slice(4)}
        </Text>
      );
      return;
    }
    if (/^##\s/.test(trimmed)) {
      nodes.push(
        <Text key={idx} style={[base, { fontFamily: "Inter_700Bold", fontSize: baseSize + 2, marginTop: 12, marginBottom: 2 }]}>
          {trimmed.slice(3)}
        </Text>
      );
      return;
    }
    if (/^#\s/.test(trimmed)) {
      nodes.push(
        <Text key={idx} style={[base, { fontFamily: "Inter_700Bold", fontSize: baseSize + 3, marginTop: 14, marginBottom: 4 }]}>
          {trimmed.slice(2)}
        </Text>
      );
      return;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-•*]\s(.+)/);
    if (bulletMatch) {
      const segs = parseInline(bulletMatch[1]!);
      nodes.push(
        <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 3, paddingLeft: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginTop: Math.floor(baseSize * 0.5) + 1, marginRight: 8, flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={base}>
              <InlineSegs segs={segs} color={color} fontSize={baseSize} />
            </Text>
          </View>
        </View>
      );
      return;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      const segs = parseInline(numMatch[2]!);
      nodes.push(
        <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 3, paddingLeft: 4 }}>
          <Text style={[base, { fontFamily: "Inter_600SemiBold", color: colors.primary, minWidth: 22, marginRight: 4 }]}>
            {numMatch[1]}.
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={base}>
              <InlineSegs segs={segs} color={color} fontSize={baseSize} />
            </Text>
          </View>
        </View>
      );
      return;
    }

    // Normal paragraph
    const segs = parseInline(trimmed);
    nodes.push(
      <Text key={idx} style={[base, { marginBottom: 1 }]}>
        <InlineSegs segs={segs} color={color} fontSize={baseSize} />
      </Text>
    );
  });

  return <View>{nodes}</View>;
}
