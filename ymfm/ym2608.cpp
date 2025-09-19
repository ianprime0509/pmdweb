#include <cstdint>
#include <new>

#include <ymfm.h>
#include <ymfm_opn.h>

struct ymfm_interface : ymfm::ymfm_interface {
    // TODO
};

struct ym2608 {
    using sample = ymfm::ym2608::output_data;

    ymfm::ym2608 impl;
    ymfm_interface intf;

    ym2608() : impl(intf) {}
};

extern "C" ym2608 *ym2608_new() {
    try {
        return new ym2608;
    } catch (const std::bad_alloc &e) {
        return nullptr;
    }
}

extern "C" void ym2608_delete(ym2608 *chip) {
    delete chip;
}

extern "C" void ym2608_reset(ym2608 *chip) {
    chip->impl.reset();
}

extern "C" uint32_t ym2608_sample_rate(ym2608 *chip, uint32_t input_clock) {
    return chip->impl.sample_rate(input_clock);
}

extern "C" void ym2608_write_address(ym2608 *chip, uint8_t data) {
    chip->impl.write_address(data);
}

extern "C" void ym2608_write_address_hi(ym2608 *chip, uint8_t data) {
    chip->impl.write_address_hi(data);
}

extern "C" void ym2608_write_data(ym2608 *chip, uint8_t data) {
    chip->impl.write_data(data);
}

extern "C" void ym2608_write_data_hi(ym2608 *chip, uint8_t data) {
    chip->impl.write_data_hi(data);
}

extern "C" void ym2608_generate(ym2608 *chip, ym2608::sample *output, uint32_t numsamples) {
    chip->impl.generate(output, numsamples);
}
