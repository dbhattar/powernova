import { VoltageColors } from "@/lib/utils";

export default function ColorMap() {
  return (
    <div className="flex flex-col rounded-lg bg-white absolute bottom-0 z-[1000] right-0">
      <div className="p-2 flex gap-4">
        {VoltageColors.map((x) => (
          <div key={x.value} className="py-1 flex flex-col justify-center items-center">
            <div
              className={`w-6 h-6 rounded mr-2`}
              style={{ backgroundColor: x.color }}
            />
            <span className="text-sm text-gray-600">
              {x.value} kV
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
