import React from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  text: string;
  baseSize?: number;
  muted?: boolean;
}

type Segment = { bold: boolean; italic: boolean; text: string };

function parseInline(raw: string): Segment[] {
  const segs: Segment[] = [];
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

export function MarkdownText({ text, baseSize = 14, muted = false }: Props) {
  const colors = useColors();
  const base = { fontSize: baseSize, lineHeight: baseSize * 1.55, fontFamily: "Inter_400Regular", color: muted ? colors.mutedForeground : colors.foreground };

  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();

    if (trimmed === "") {
      nodes.push(<View key={idx} style={{ height: 6 }} />);
      return;
    }

    if (/^#{1,2}\s/.test(trimmed)) {
      const isH1 = trimmed.startsWith("# ");
      const content = trimmed.replace(/^#{1,2}\s/, "");
      nodes.push(
        <Text key={idx} style={[base, { fontFamily: "Inter_700Bold", fontSize: isH1 ? baseSize + 2 : baseSize + 1, marginTop: 8, marginBottom: 2 }]}>
          {content}
        </Text>
      );
      return;
    }

    const bulletMatch = trimmed.match(/^[-•*]\s(.+)/);
    if (bulletMatch) {
      nodes.push(
        <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 2, paddingLeft: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginTop: Math.floor(baseSize * 0.55), marginRight: 8, flexShrink: 0 }} />
          <Text style={[base, { flex: 1 }]}>{renderSegs(parseInline(bulletMatch[1]!), base, colors)}</Text>
        </View>
      );
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      nodes.push(
        <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 2, paddingLeft: 4 }}>
          <Text style={[base, { fontFamily: "Inter_600SemiBold", color: colors.primary, minWidth: 20, marginRight: 6 }]}>{numMatch[1]}.</Text>
          <Text style={[base, { flex: 1 }]}>{renderSegs(parseInline(numMatch[2]!), base, colors)}</Text>
        </View>
      );
      return;
    }

    nodes.push(
      <Text key={idx} style={base}>
        {renderSegs(parseInline(trimmed), base, colors)}
      </Text>
    );
  });

  return <>{nodes}</>;
}

function renderSegs(segs: Segment[], base: any, colors: any): React.ReactNode {
  return segs.map((s, i) => (
    <Text
      key={i}
      style={{
        fontFamily: s.bold ? "Inter_700Bold" : s.italic ? "Inter_400Regular" : base.fontFamily,
        fontStyle: s.italic ? "italic" : "normal",
        color: base.color,
        fontSize: base.fontSize,
      }}
    >
      {s.text}
    </Text>
  ));
}
